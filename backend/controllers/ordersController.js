const pool = require("../db");
const { z } = require("zod");
const { orderSchema, statusUpdateSchema } = require("../middleware/schemas");
const { canTransition } = require("../utils/stateMachine");

// Вспомогательные функции для финансов (в центах)
function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function fromCents(cents) {
  return Number(cents) / 100;
}

function addCents(...amounts) {
  return amounts.reduce((sum, cents) => sum + (Number(cents) || 0), 0);
}

// Нормализация JSON полей
function normalizeJsonField(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }
  return typeof value === "object" ? value : null;
}

function serializeJsonField(value) {
  const normalized = normalizeJsonField(value);
  return normalized ? JSON.stringify(normalized) : null;
}

// Определение категории камня
function determineStoneCategory(materialId, snapshot) {
  if (!materialId) return "other";

  const id = String(materialId).toLowerCase();

  if (id.includes("acryl") || id.includes("акрил")) return "acrylic";
  if (id.includes("quartz") || id.includes("кварц") || id.includes("q-"))
    return "quartz";

  if (snapshot && typeof snapshot === "object") {
    const stoneName = (snapshot.stoneName || "").toLowerCase();
    if (stoneName.includes("акрил") || stoneName.includes("acryl"))
      return "acrylic";
    if (stoneName.includes("кварц") || stoneName.includes("quartz"))
      return "quartz";
  }

  return "other";
}

// Создание финансовой записи
async function createOrderFinance(connection, orderId, validatedData, items) {
  const snapshot = normalizeJsonField(validatedData.calculator_snapshot);
  const materialId =
    items && items.length > 0
      ? items[0].material_id || items[0].materialId
      : null;
  const stoneCategory = determineStoneCategory(materialId, snapshot);

  const totalRevenueCents = toCents(validatedData.total_amount || 0);
  const prepaymentCents = toCents(validatedData.prepayment || 0);
  const balanceCents = totalRevenueCents - prepaymentCents;

  let materialCostCents = 0;
  let productionCostCents = 0;

  if (snapshot && snapshot.isInitialized) {
    const matUSD = Number(snapshot.matUSD) || 0;
    const exchangeRate = validatedData.exchange_rate || 3.2;
    const materialCostCentsExact = Math.round(matUSD * exchangeRate * 100);
    materialCostCents = materialCostCentsExact;

    const prodUSD = Number(snapshot.prodUSD) || 0;
    const productionCostCentsExact = Math.round(prodUSD * exchangeRate * 100);
    productionCostCents = productionCostCentsExact;
  }

  await connection.query(
    `INSERT INTO order_finances 
     (order_id, stone_category, material_cost_cents, production_cost_cents, 
      total_revenue_cents, prepayment_cents, balance_cents, currency, 
      exchange_rate, calculation_snapshot) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 'BYN', ?, ?)`,
    [
      orderId,
      stoneCategory,
      materialCostCents,
      productionCostCents,
      totalRevenueCents,
      prepaymentCents,
      balanceCents,
      validatedData.exchange_rate || null,
      JSON.stringify(snapshot || {}),
    ],
  );
}

// Получение всех заказов
async function getAllOrders(req, res) {
  try {
    const query = `
      SELECT 
        o.order_id,
        o.status_id,
        o.total_amount,
        o.deadline_date,
        o.installation_address,
        c.full_name AS client_name,
        c.phone AS client_phone,
        u.full_name AS manager_name,
        s.status_name
      FROM orders o
      INNER JOIN clients c ON o.client_id = c.client_id
      INNER JOIN users u ON o.manager_id = u.user_id
      INNER JOIN dict_order_statuses s ON o.status_id = s.status_id
      ORDER BY o.order_id DESC
    `;
    const [orders] = await pool.query(query);
    res.json(orders);
  } catch (error) {
    console.error("Ошибка при получении заказов:", error);
    res.status(500).json({ error: error.message });
  }
}

// Получение одного заказа
async function getOrderById(req, res) {
  const orderId = req.params.id;
  try {
    const [orderRows] = await pool.query(
      `
        SELECT
          o.order_id,
          o.client_id,
          o.manager_id,
          o.status_id,
          o.total_amount,
          o.prepayment,
          o.installation_address,
          o.deadline_date,
          o.exchange_rate,
          o.calculator_snapshot,
          c.full_name AS client_name,
          c.phone AS client_phone,
          c.email AS client_email,
          NULL AS client_address,
          u.full_name AS manager_name,
          s.status_name
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.client_id
        LEFT JOIN users u ON o.manager_id = u.user_id
        LEFT JOIN dict_order_statuses s ON o.status_id = s.status_id
        WHERE o.order_id = ?
      `,
      [orderId],
    );

    if (!orderRows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Заказ не найден" });
    }

    const [itemRows] = await pool.query(
      `
        SELECT
          oi.item_id AS order_item_id,
          oi.product_type_id,
          oi.material_id,
          oi.length_mm,
          oi.width_mm,
          oi.area_m2,
          oi.edge_profile_id,
          oi.edge_length_m,
          oi.item_cost,
          m.title AS material_title
        FROM order_items oi
        LEFT JOIN materials m ON oi.material_id = m.material_id
        WHERE oi.order_id = ?
        ORDER BY oi.item_id ASC
      `,
      [orderId],
    );

    const rawSnapshot = orderRows[0]?.calculator_snapshot;
    const parsedSnapshot = normalizeJsonField(rawSnapshot);

    res.json({
      success: true,
      order: {
        ...orderRows[0],
        calculator_snapshot: parsedSnapshot,
        calculatorData: parsedSnapshot,
        items: itemRows,
      },
    });
  } catch (error) {
    console.error("Ошибка при получении заказа:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Обновление заказа
async function updateOrder(req, res) {
  const orderId = req.params.id;
  const validatedData = req.validatedBody;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Проверка возможности перехода статуса
    if (validatedData.status_id) {
      const [currentOrder] = await connection.query(
        "SELECT status_id FROM orders WHERE order_id = ?",
        [orderId],
      );

      if (currentOrder.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Заказ не найден" });
      }

      const currentStatus = currentOrder[0].status_id;
      if (!canTransition(currentStatus, validatedData.status_id)) {
        return res.status(400).json({
          success: false,
          message: `Недопустимый переход статуса: ${currentStatus} → ${validatedData.status_id}`,
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (validatedData.total_amount !== undefined) {
      updateFields.push("total_amount = ?");
      updateValues.push(toCents(validatedData.total_amount));
    }

    if (validatedData.prepayment !== undefined) {
      updateFields.push("prepayment = ?");
      updateValues.push(toCents(validatedData.prepayment));
    }

    if (validatedData.installation_address !== undefined) {
      updateFields.push("installation_address = ?");
      updateValues.push(validatedData.installation_address ?? null);
    }

    if (validatedData.deadline_date !== undefined) {
      updateFields.push("deadline_date = ?");
      updateValues.push(validatedData.deadline_date ?? null);
    }

    if (validatedData.status_id !== undefined) {
      updateFields.push("status_id = ?");
      updateValues.push(validatedData.status_id);
    }

    if (validatedData.exchange_rate !== undefined) {
      updateFields.push("exchange_rate = ?");
      updateValues.push(
        validatedData.exchange_rate === "" ||
          validatedData.exchange_rate === null
          ? null
          : validatedData.exchange_rate,
      );
    }

    if (validatedData.calculator_snapshot !== undefined) {
      updateFields.push("calculator_snapshot = ?");
      updateValues.push(serializeJsonField(validatedData.calculator_snapshot));
    }

    if (updateFields.length > 0) {
      updateValues.push(orderId);
      await connection.query(
        `UPDATE orders SET ${updateFields.join(", ")} WHERE order_id = ?`,
        updateValues,
      );
    }

    if (validatedData.client) {
      const [orderRows] = await connection.query(
        "SELECT client_id FROM orders WHERE order_id = ?",
        [orderId],
      );
      const resolvedClientId =
        validatedData.client_id || orderRows[0]?.client_id;

      if (resolvedClientId) {
        const clientFields = [];
        const clientValues = [];

        if (validatedData.client.full_name !== undefined) {
          clientFields.push("full_name = ?");
          clientValues.push(validatedData.client.full_name || null);
        }

        if (validatedData.client.phone !== undefined) {
          clientFields.push("phone = ?");
          clientValues.push(validatedData.client.phone || null);
        }

        if (validatedData.client.email !== undefined) {
          clientFields.push("email = ?");
          clientValues.push(validatedData.client.email || null);
        }

        if (validatedData.client.address !== undefined) {
          clientFields.push("address = ?");
          clientValues.push(validatedData.client.address || null);
        }

        if (clientFields.length > 0) {
          clientValues.push(resolvedClientId);
          await connection.query(
            `UPDATE clients SET ${clientFields.join(", ")} WHERE client_id = ?`,
            clientValues,
          );
        }
      }
    }

    // Обновляем финансовую запись
    if (
      validatedData.calculator_snapshot !== undefined ||
      validatedData.total_amount !== undefined
    ) {
      const [existingFinance] = await connection.query(
        "SELECT finance_id FROM order_finances WHERE order_id = ?",
        [orderId],
      );

      if (existingFinance.length > 0) {
        const snapshot = normalizeJsonField(validatedData.calculator_snapshot);
        const totalRevenueCents = toCents(validatedData.total_amount || 0);
        const prepaymentCents = toCents(validatedData.prepayment || 0);
        const balanceCents = totalRevenueCents - prepaymentCents;

        let materialCostCents = 0;
        let productionCostCents = 0;

        if (snapshot && snapshot.isInitialized) {
          const matUSD = Number(snapshot.matUSD) || 0;
          const prodUSD = Number(snapshot.prodUSD) || 0;
          const exchangeRate = validatedData.exchange_rate || 3.2;
          const materialCostCentsExact = Math.round(
            matUSD * exchangeRate * 100,
          );
          materialCostCents = materialCostCentsExact;
          const productionCostCentsExact = Math.round(
            prodUSD * exchangeRate * 100,
          );
          productionCostCents = productionCostCentsExact;
        }

        await connection.query(
          `UPDATE order_finances 
           SET total_revenue_cents = ?, prepayment_cents = ?, balance_cents = ?,
               material_cost_cents = ?, production_cost_cents = ?,
               exchange_rate = ?, calculation_snapshot = ?
           WHERE order_id = ?`,
          [
            totalRevenueCents,
            prepaymentCents,
            balanceCents,
            materialCostCents,
            productionCostCents,
            validatedData.exchange_rate || null,
            JSON.stringify(snapshot || {}),
            orderId,
          ],
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Заказ успешно обновлен" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Ошибка обновления заказа:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
}

// Создание заказа
async function createOrder(req, res) {
  const validatedData = req.validatedBody;
  const {
    client_id,
    manager_id,
    status_id = "lead",
    items = [],
    client = null,
    exchange_rate,
    calculator_snapshot,
  } = validatedData;

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Не переданы позиции заказа" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let resolvedClientId = client_id || null;

    if (!resolvedClientId && client) {
      const clientPhone =
        client.phone && client.phone.trim() ? client.phone.trim() : "Не указан";
      const [clientResult] = await connection.query(
        "INSERT INTO clients (full_name, phone, email, source_id) VALUES (?, ?, ?, ?)",
        [
          client.full_name || client.name || "Не указано",
          clientPhone,
          client.email || null,
          client.source_id || null,
        ],
      );
      resolvedClientId = clientResult.insertId;
    }

    const normalizedSnapshot = normalizeJsonField(calculator_snapshot);
    const serializedSnapshot = normalizedSnapshot
      ? JSON.stringify(normalizedSnapshot)
      : null;

    const totalAmount = validatedData.total_amount || 0;
    const prepayment = validatedData.prepayment || 0;

    const [orderResult] = await connection.query(
      "INSERT INTO orders (client_id, manager_id, status_id, total_amount, installation_address, deadline_date, exchange_rate, calculator_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        resolvedClientId,
        manager_id || null,
        status_id,
        toCents(totalAmount),
        validatedData.installation_address || null,
        validatedData.deadline_date || null,
        exchange_rate === "" ||
        exchange_rate === null ||
        exchange_rate === undefined
          ? null
          : Number(exchange_rate),
        serializedSnapshot,
      ],
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      const materialId = item.material_id ?? item.materialId ?? "custom";
      const [stoneRows] = await connection.query(
        "SELECT material_id FROM materials WHERE material_id = ?",
        [materialId],
      );

      if (stoneRows.length === 0) {
        await connection.query(
          "INSERT INTO materials (material_id, type_id, title, fabricator, price_per_m2) VALUES (?, ?, ?, ?, ?)",
          [materialId, "quartz", `Авто-камень (${materialId})`, "Импорт", 0.0],
        );
      }

      await connection.query(
        "INSERT INTO order_items (order_id, product_type_id, material_id, length_mm, width_mm, area_m2, edge_profile_id, edge_length_m, item_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          orderId,
          item.product_type_id ?? item.productTypeId ?? 1,
          materialId,
          item.length_mm ?? item.lengthMm ?? null,
          item.width_mm ?? item.widthMm ?? null,
          item.area_m2 ?? item.areaM2 ?? null,
          item.edge_profile_id ?? item.edgeProfileId ?? 1,
          item.edge_length_m ?? item.edgeLengthM ?? null,
          item.item_cost ?? item.itemCost ?? null,
        ],
      );
    }

    // Создаем финансовую запись
    await createOrderFinance(connection, orderId, validatedData, items);

    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Заказ успешно создан",
      order_id: orderId,
      exchange_rate:
        exchange_rate === "" ||
        exchange_rate === null ||
        exchange_rate === undefined
          ? null
          : Number(exchange_rate),
      calculator_snapshot: normalizedSnapshot,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Ошибка создания заказа:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка создания заказа",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
}

// Обновление статуса заказа
async function updateOrderStatus(req, res) {
  const orderId = req.params.id;
  const { status_id } = req.validatedBody;

  try {
    const [currentOrder] = await pool.query(
      "SELECT status_id FROM orders WHERE order_id = ?",
      [orderId],
    );

    if (currentOrder.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Заказ не найден" });
    }

    const currentStatus = currentOrder[0].status_id;
    if (!canTransition(currentStatus, status_id)) {
      return res.status(400).json({
        success: false,
        message: `Недопустимый переход статуса: ${currentStatus} → ${status_id}`,
      });
    }

    const [result] = await pool.query(
      "UPDATE orders SET status_id = ? WHERE order_id = ?",
      [status_id, orderId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Заказ не найден" });
    }

    res.json({ success: true, message: "Статус успешно обновлен" });
  } catch (error) {
    console.error("Ошибка обновления статуса:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера" });
  }
}

module.exports = {
  getAllOrders,
  getOrderById,
  updateOrder,
  createOrder,
  updateOrderStatus,
};
