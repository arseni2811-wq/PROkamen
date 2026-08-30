const pool = require("../db");
const crypto = require("crypto");
const { canTransition } = require("../utils/stateMachine");

// Вспомогательные функции для финансов (в центах)
function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
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

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestHash(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

async function claimIdempotencyKey(connection, actorId, key, hash) {
  if (!key) return { claimed: false };
  try {
    await connection.query(
      `INSERT INTO order_idempotency_keys
       (actor_id, idempotency_key, request_hash)
       VALUES (?, ?, ?)`,
      [actorId, key, hash],
    );
    return { claimed: true };
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;
    const [rows] = await connection.query(
      `SELECT request_hash, response_status, response_body
       FROM order_idempotency_keys
       WHERE actor_id = ? AND idempotency_key = ?
       FOR UPDATE`,
      [actorId, key],
    );
    const existing = rows[0];
    if (!existing || existing.request_hash !== hash) {
      return { conflict: true };
    }
    if (!existing.response_status || !existing.response_body) {
      return { conflict: true };
    }
    return {
      replay: true,
      status: Number(existing.response_status),
      body: normalizeJsonField(existing.response_body),
    };
  }
}

// Запись действия в журнал заказа (работает и внутри транзакции, и вне её)
async function logOrderAction(
  connection,
  orderId,
  action,
  description,
  userId,
) {
  const executor = connection || pool;
  await executor.query(
    "INSERT INTO order_history_log (order_id, action, description, user_id) VALUES (?, ?, ?, ?)",
    [orderId, action, description || null, userId || null],
  );
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

async function findMissingOrderReference(
  connection,
  { clientId, managerId, items = [], checkPeople = true },
) {
  if (checkPeople) {
    const [clients] = await connection.query(
      "SELECT client_id FROM clients WHERE client_id = ?",
      [clientId],
    );
    if (clients.length === 0) return "Клиент не найден";

    const [managers] = await connection.query(
      "SELECT user_id FROM users WHERE user_id = ?",
      [managerId],
    );
    if (managers.length === 0) return "Менеджер не найден";
  }

  for (const item of items) {
    const productTypeId = item.product_type_id ?? item.productTypeId ?? 1;
    const [productTypes] = await connection.query(
      "SELECT type_id FROM dict_product_types WHERE type_id = ?",
      [productTypeId],
    );
    if (productTypes.length === 0) {
      return `Тип изделия ${productTypeId} не найден`;
    }

    const edgeProfileId = item.edge_profile_id ?? item.edgeProfileId ?? 1;
    if (edgeProfileId !== null) {
      const [edgeProfiles] = await connection.query(
        "SELECT profile_id FROM dict_edge_profiles WHERE profile_id = ?",
        [edgeProfileId],
      );
      if (edgeProfiles.length === 0) {
        return `Профиль кромки ${edgeProfileId} не найден`;
      }
    }
  }
  return null;
}

// Получение всех заказов
async function getAllOrders(req, res) {
  try {
    const managerFilter =
      req.user?.role_id === 2 ? "WHERE o.manager_id = ?" : "";
    const query = `
      SELECT 
        o.order_id,
        o.version,
        o.status_id,
        o.total_amount,
        o.prepayment,
        DATE_FORMAT(o.deadline_date, '%Y-%m-%d') AS deadline_date,
        o.installation_address,
        c.full_name AS client_name,
        c.phone AS client_phone,
        u.full_name AS manager_name,
        s.status_name
      FROM orders o
      INNER JOIN clients c ON o.client_id = c.client_id
      INNER JOIN users u ON o.manager_id = u.user_id
      INNER JOIN dict_order_statuses s ON o.status_id = s.status_id
      ${managerFilter}
      ORDER BY o.order_id DESC
    `;
    const [orders] = await pool.query(
      query,
      req.user?.role_id === 2 ? [req.user.user_id] : [],
    );
    res.json(orders);
  } catch (error) {
    console.error("Ошибка при получении заказов:", error);
    res.status(500).json({ success: false, message: "Не удалось получить заказы" });
  }
}

async function getProductionOrders(req, res) {
  try {
    const managerFilter =
      req.user?.role_id === 2 ? "AND o.manager_id = ?" : "";
    const [orders] = await pool.query(
      `SELECT
         o.order_id,
         o.version,
         o.status_id,
         DATE_FORMAT(o.deadline_date, '%Y-%m-%d') AS deadline_date,
         o.stone_name,
         o.product_type,
         o.installation_address
       FROM orders o
       WHERE o.status_id IN ('waiting_stone', 'in_production', 'ready_shipping')
       ${managerFilter}
       ORDER BY o.deadline_date IS NULL, o.deadline_date, o.order_id`,
      req.user?.role_id === 2 ? [req.user.user_id] : [],
    );
    res.json(orders);
  } catch (error) {
    console.error("Ошибка получения производственных заказов:", error);
    res.status(500).json({
      success: false,
      message: "Не удалось получить производственные заказы",
    });
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
          o.version,
          o.client_id,
          o.manager_id,
          o.status_id,
          o.total_amount,
          o.prepayment,
          o.installation_address,
          o.order_source,
          o.stone_name,
          o.product_type,
          DATE_FORMAT(o.deadline_date, '%Y-%m-%d') AS deadline_date,
          o.exchange_rate,
          o.calculator_snapshot,
          o.deadlines,
          c.full_name AS client_name,
          c.phone AS client_phone,
          c.email AS client_email,
          c.address AS client_address,
          c.social_networks AS client_social,
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

    const [historyRows] = await pool.query(
      `
        SELECT
          h.created_at,
          h.action,
          h.description,
          COALESCE(u.full_name, 'Система') AS user_name
        FROM order_history_log h
        LEFT JOIN users u ON h.user_id = u.user_id
        WHERE h.order_id = ?
        ORDER BY h.created_at DESC
      `,
      [orderId],
    );
    const history = historyRows.map((h) => ({
      date: h.created_at ? new Date(h.created_at).toLocaleString("ru-RU") : "",
      user: h.user_name,
      action: h.action,
      comment: h.description || "",
    }));

    res.json({
      success: true,
      order: {
        ...orderRows[0],
        calculator_snapshot: parsedSnapshot,
        calculatorData: parsedSnapshot,
        items: itemRows,
        history,
        // Алиас для обратной совместимости фронтенда
        logs: history,
      },
    });
  } catch (error) {
    console.error("Ошибка при получении заказа:", error);
    res.status(500).json({ success: false, message: "Не удалось получить заказ" });
  }
}

// Обновление заказа
async function updateOrder(req, res) {
  const orderId = req.params.id;
  const validatedData = req.validatedBody;
  const expectedVersion = validatedData.version;

  if (validatedData.calculator_snapshot !== undefined) {
    return res.status(400).json({
      success: false,
      message: "Снимок калькулятора сохраняется через /calculator",
    });
  }
  if (
    req.user?.role_id !== 1 &&
    validatedData.manager_id != null &&
    Number(validatedData.manager_id) !== Number(req.user?.user_id)
  ) {
    return res.status(403).json({
      success: false,
      message: "Менеджер не может переназначить заказ",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Блокируем строку заказа на время частичного обновления. Помимо честного
    // 404 это не даёт двум параллельным сохранениям построить финансовый снимок
    // из одного и того же устаревшего состояния.
    const [currentOrders] = await connection.query(
      `SELECT order_id, client_id, manager_id, status_id, total_amount, prepayment, version,
              exchange_rate, calculator_snapshot
       FROM orders
       WHERE order_id = ?
       FOR UPDATE`,
      [orderId],
    );
    const currentOrder = currentOrders[0];
    if (!currentOrder) {
      await connection.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Заказ не найден" });
    }
    if (Number(currentOrder.version) !== Number(expectedVersion)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Заказ был изменен другим пользователем",
        current_version: Number(currentOrder.version),
      });
    }

    // Проверка возможности перехода статуса
    if (validatedData.status_id) {
      const currentStatus = currentOrder.status_id;
      if (
        !canTransition(currentStatus, validatedData.status_id, {
          isAdmin: req.user?.role_id === 1,
        })
      ) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Недопустимый переход статуса: ${currentStatus} → ${validatedData.status_id}`,
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (req.user?.role_id === 1 && validatedData.manager_id !== undefined) {
      const [managerRows] = await connection.query(
        "SELECT user_id FROM users WHERE user_id = ?",
        [validatedData.manager_id],
      );
      if (managerRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "Менеджер не найден",
        });
      }
      updateFields.push("manager_id = ?");
      updateValues.push(validatedData.manager_id);
    }

    if (validatedData.total_amount !== undefined) {
      updateFields.push("total_amount = ?");
      // orders.total_amount — DECIMAL(10,2): храним РУБЛИ без *100
      updateValues.push(validatedData.total_amount);
    }

    if (validatedData.prepayment !== undefined) {
      updateFields.push("prepayment = ?");
      updateValues.push(validatedData.prepayment);
    }

    if (validatedData.installation_address !== undefined) {
      updateFields.push("installation_address = ?");
      updateValues.push(validatedData.installation_address || null);
    }

    if (validatedData.order_source !== undefined) {
      updateFields.push("order_source = ?");
      updateValues.push(validatedData.order_source || null);
    }

    if (validatedData.stone_name !== undefined) {
      updateFields.push("stone_name = ?");
      updateValues.push(validatedData.stone_name || null);
    }

    if (validatedData.product_type !== undefined) {
      updateFields.push("product_type = ?");
      updateValues.push(validatedData.product_type || null);
    }

    if (validatedData.deadline_date !== undefined) {
      updateFields.push("deadline_date = ?");
      updateValues.push(
        validatedData.deadline_date === "" ||
          validatedData.deadline_date === null
          ? null
          : validatedData.deadline_date,
      );
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

    if (validatedData.deadlines !== undefined) {
      updateFields.push("deadlines = ?");
      updateValues.push(serializeJsonField(validatedData.deadlines));
    }

    updateFields.push("version = version + 1");
    updateValues.push(orderId, expectedVersion);
    const [versionedUpdate] = await connection.query(
      `UPDATE orders SET ${updateFields.join(", ")}
       WHERE order_id = ? AND version = ?`,
      updateValues,
    );
    if (versionedUpdate.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Заказ был изменен другим пользователем",
      });
    }

    // Синхронизация позиций заказа (order_items): если фронтенд прислал items,
    // полностью заменяем старый набор позиций новым.
    if (Array.isArray(validatedData.items)) {
      const missingReference = await findMissingOrderReference(connection, {
        items: validatedData.items,
        checkPeople: false,
      });
      if (missingReference) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: missingReference,
        });
      }

      await connection.query("DELETE FROM order_items WHERE order_id = ?", [
        orderId,
      ]);

      for (const item of validatedData.items) {
        const materialId = item.material_id ?? item.materialId ?? "custom";
        const [stoneRows] = await connection.query(
          "SELECT material_id FROM materials WHERE material_id = ?",
          [materialId],
        );
        if (stoneRows.length === 0) {
          await connection.query(
            "INSERT INTO materials (material_id, type_id, title, fabricator, price_per_m2) VALUES (?, ?, ?, ?, ?)",
            [
              materialId,
              "quartz",
              `Авто-камень (${materialId})`,
              "Импорт",
              0.0,
            ],
          );
        }
        await connection.query(
          "INSERT INTO order_items (order_id, product_type_id, material_id, length_mm, width_mm, area_m2, edge_profile_id, edge_length_m, item_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            orderId,
            item.product_type_id ?? item.productTypeId ?? 1,
            materialId,
            (item.length_mm ?? item.lengthMm) || 0,
            (item.width_mm ?? item.widthMm) || 0,
            (item.area_m2 ?? item.areaM2) || 0,
            item.edge_profile_id ?? item.edgeProfileId ?? 1,
            (item.edge_length_m ?? item.edgeLengthM) || 0,
            (item.item_cost ?? item.itemCost) || 0,
          ],
        );
      }
    }

    if (validatedData.client) {
      const resolvedClientId =
        validatedData.client_id || currentOrder.client_id;

      if (resolvedClientId) {
        const clientFields = [];
        const clientValues = [];

        if (validatedData.client.full_name !== undefined) {
          clientFields.push("full_name = ?");
          // full_name/phone — NOT NULL: пустая строка/undefined ⇒ fallback,
          // иначе "Column 'full_name' cannot be null"
          clientValues.push(validatedData.client.full_name || "Не указано");
        }

        if (validatedData.client.phone !== undefined) {
          clientFields.push("phone = ?");
          clientValues.push(validatedData.client.phone || "Не указан");
        }

        if (validatedData.client.email !== undefined) {
          clientFields.push("email = ?");
          clientValues.push(validatedData.client.email || null);
        }

        if (validatedData.client.address !== undefined) {
          clientFields.push("address = ?");
          clientValues.push(validatedData.client.address || null);
        }

        if (validatedData.client.social_networks !== undefined) {
          clientFields.push("social_networks = ?");
          clientValues.push(validatedData.client.social_networks || null);
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
      validatedData.total_amount !== undefined ||
      validatedData.prepayment !== undefined
    ) {
      const [existingFinance] = await connection.query(
        "SELECT finance_id FROM order_finances WHERE order_id = ?",
        [orderId],
      );

      // PUT здесь используется как частичное обновление. Финансовое зеркало
      // должно собираться из нового значения поля И текущих значений остальных
      // полей, иначе сохранение одной предоплаты обнуляло сумму и калькулятор.
      const snapshot = normalizeJsonField(currentOrder.calculator_snapshot);
      const effectiveTotal =
        validatedData.total_amount !== undefined
          ? validatedData.total_amount
          : currentOrder.total_amount;
      const effectivePrepayment =
        validatedData.prepayment !== undefined
          ? validatedData.prepayment
          : currentOrder.prepayment;
      const effectiveExchangeRate =
        validatedData.exchange_rate !== undefined
          ? validatedData.exchange_rate
          : currentOrder.exchange_rate;
      const totalRevenueCents = toCents(effectiveTotal);
      const prepaymentCents = toCents(effectivePrepayment);
      const balanceCents = totalRevenueCents - prepaymentCents;

      let materialCostCents = 0;
      let productionCostCents = 0;

      if (snapshot && snapshot.isInitialized) {
        const matUSD = Number(snapshot.matUSD) || 0;
        const prodUSD = Number(snapshot.prodUSD) || 0;
        const exchangeRate = effectiveExchangeRate || 3.2;
        materialCostCents = Math.round(matUSD * exchangeRate * 100);
        productionCostCents = Math.round(prodUSD * exchangeRate * 100);
      }

      if (existingFinance.length > 0) {
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
            effectiveExchangeRate ?? null,
            JSON.stringify(snapshot || {}),
            orderId,
          ],
        );
      } else {
        await connection.query(
          `INSERT INTO order_finances
           (order_id, stone_category, material_cost_cents,
            production_cost_cents, total_revenue_cents, prepayment_cents,
            balance_cents, currency, exchange_rate, calculation_snapshot)
           VALUES (?, 'other', ?, ?, ?, ?, ?, 'BYN', ?, ?)`,
          [
            orderId,
            materialCostCents,
            productionCostCents,
            totalRevenueCents,
            prepaymentCents,
            balanceCents,
            effectiveExchangeRate ?? null,
            JSON.stringify(snapshot || {}),
          ],
        );
      }
    }

    // Логируем изменения заказа
    const changedList = [
      ...updateFields.map((f) => f.split(" = ")[0]),
      validatedData.client ? "клиент" : null,
      Array.isArray(validatedData.items) ? "позиции заказа" : null,
    ].filter(Boolean);
    await logOrderAction(
      connection,
      orderId,
      "Обновление заказа",
      changedList.length > 0
        ? `Изменено: ${changedList.join(", ")}`
        : "Заказ обновлен",
      req.user?.user_id,
    );

    await connection.commit();
    res.json({
      success: true,
      message: "Заказ успешно обновлен",
      version: Number(expectedVersion) + 1,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Ошибка обновления заказа:", error);
    res.status(500).json({ success: false, message: "Не удалось обновить заказ" });
  } finally {
    if (connection) connection.release();
  }
}

// Создание заказа
async function createOrder(req, res) {
  const validatedData = req.validatedBody;
  const rawIdempotencyKey =
    req.get?.("Idempotency-Key") || req.headers?.["idempotency-key"] || null;
  const idempotencyKey = rawIdempotencyKey
    ? String(rawIdempotencyKey).trim()
    : null;
  if (rawIdempotencyKey && (!idempotencyKey || idempotencyKey.length > 255)) {
    return res.status(400).json({
      success: false,
      message: "Некорректный Idempotency-Key",
    });
  }
  const payloadHash = idempotencyKey ? requestHash(validatedData) : null;
  const {
    client_id,
    manager_id,
    status_id = "lead",
    items = [],
    client = null,
    exchange_rate,
    calculator_snapshot,
  } = validatedData;

  // Назначать заказ другому сотруднику может только администратор. Иначе
  // manager_id из тела позволял горизонтально подменить владельца заказа.
  const effectiveManagerId =
    req.user?.role_id === 1 && manager_id
      ? manager_id
      : req.user?.user_id || null;

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Не переданы позиции заказа" });
  }
  if (!effectiveManagerId) {
    return res.status(400).json({
      success: false,
      message: "Не удалось определить менеджера заказа",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const idempotency = await claimIdempotencyKey(
      connection,
      req.user.user_id,
      idempotencyKey,
      payloadHash,
    );
    if (idempotency.conflict) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Idempotency-Key уже использован с другим запросом",
      });
    }
    if (idempotency.replay) {
      await connection.rollback();
      res.set("Idempotency-Replayed", "true");
      return res.status(idempotency.status).json(idempotency.body);
    }

    let resolvedClientId = client_id || null;

    if (!resolvedClientId && client) {
      const clientPhone =
        client.phone && client.phone.trim() ? client.phone.trim() : "Не указан";
      const [clientResult] = await connection.query(
        "INSERT INTO clients (full_name, phone, email, address, social_networks, source_id) VALUES (?, ?, ?, ?, ?, ?)",
        [
          client.full_name || client.name || "Не указано",
          clientPhone,
          client.email || null,
          client.address || null,
          client.social_networks || null,
          client.source_id || null,
        ],
      );
      resolvedClientId = clientResult.insertId;
    }

    if (!resolvedClientId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Не выбран и не передан клиент заказа",
      });
    }

    const missingReference = await findMissingOrderReference(connection, {
      clientId: resolvedClientId,
      managerId: effectiveManagerId,
      items,
    });
    if (missingReference) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: missingReference,
      });
    }

    const normalizedSnapshot = normalizeJsonField(calculator_snapshot);
    const serializedSnapshot = normalizedSnapshot
      ? JSON.stringify(normalizedSnapshot)
      : null;

    const totalAmount = validatedData.total_amount || 0;
    const prepayment = validatedData.prepayment || 0;

    const [orderResult] = await connection.query(
      "INSERT INTO orders (client_id, manager_id, status_id, total_amount, prepayment, installation_address, deadline_date, deadlines, exchange_rate, calculator_snapshot, order_source, stone_name, product_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        resolvedClientId,
        effectiveManagerId,
        status_id || "lead",
        totalAmount,
        prepayment,
        validatedData.installation_address || null,
        validatedData.deadline_date || null,
        serializeJsonField(validatedData.deadlines),
        exchange_rate === "" ||
        exchange_rate === null ||
        exchange_rate === undefined
          ? null
          : Number(exchange_rate),
        serializedSnapshot,
        validatedData.order_source || null,
        validatedData.stone_name || null,
        validatedData.product_type || null,
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
          // NULL-поля в NOT NULL-колонках (length_mm, width_mm, area_m2,
          // item_cost) заменяются на 0, чтобы INSERT не падал с
          // "Column '...' cannot be null".
          (item.length_mm ?? item.lengthMm) || 0,
          (item.width_mm ?? item.widthMm) || 0,
          (item.area_m2 ?? item.areaM2) || 0,
          item.edge_profile_id ?? item.edgeProfileId ?? 1,
          (item.edge_length_m ?? item.edgeLengthM) || 0,
          (item.item_cost ?? item.itemCost) || 0,
        ],
      );
    }

    // Создаем финансовую запись
    await createOrderFinance(connection, orderId, validatedData, items);
    await logOrderAction(
      connection,
      orderId,
      "Создание заказа",
      `Заказ создан (${items.length} поз.), сумма: ${totalAmount} BYN`,
      req.user?.user_id,
    );

    const responseBody = {
      success: true,
      message: "Заказ успешно создан",
      order_id: orderId,
      order: { order_id: orderId, version: 1 },
      version: 1,
      exchange_rate:
        exchange_rate === "" ||
        exchange_rate === null ||
        exchange_rate === undefined
          ? null
          : Number(exchange_rate),
      calculator_snapshot: normalizedSnapshot,
    };
    if (idempotencyKey) {
      await connection.query(
        `UPDATE order_idempotency_keys
         SET order_id = ?, response_status = 201, response_body = ?
         WHERE actor_id = ? AND idempotency_key = ?`,
        [
          orderId,
          JSON.stringify(responseBody),
          req.user.user_id,
          idempotencyKey,
        ],
      );
    }
    await connection.commit();
    res.status(201).json(responseBody);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Ошибка создания заказа:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка создания заказа",
    });
  } finally {
    if (connection) connection.release();
  }
}

async function updateOrderCalculator(req, res) {
  const orderId = req.params.id;
  const {
    version: expectedVersion,
    total_amount: totalAmount,
    exchange_rate: exchangeRate,
    calculator_snapshot: snapshot,
  } = req.validatedBody;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orders] = await connection.query(
      `SELECT order_id, prepayment, version
       FROM orders WHERE order_id = ? FOR UPDATE`,
      [orderId],
    );
    const currentOrder = orders[0];
    if (!currentOrder) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    if (Number(currentOrder.version) !== Number(expectedVersion)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Заказ был изменен другим пользователем",
        current_version: Number(currentOrder.version),
      });
    }

    const [items] = await connection.query(
      `SELECT item_id, product_type_id
       FROM order_items WHERE order_id = ? ORDER BY item_id FOR UPDATE`,
      [orderId],
    );
    if (items.length > 1) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Калькулятор не может однозначно выбрать позицию многопозиционного заказа",
      });
    }

    const materialId = snapshot.stoneId === "0" ? "custom" : snapshot.stoneId;
    const edgeProfileId = snapshot.isThickEdge ? 2 : 1;
    const referenceError = await findMissingOrderReference(connection, {
      items: [
        {
          product_type_id: items[0]?.product_type_id || 1,
          edge_profile_id: edgeProfileId,
        },
      ],
      checkPeople: false,
    });
    if (referenceError) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: referenceError });
    }

    const [materials] = await connection.query(
      "SELECT material_id FROM materials WHERE material_id = ?",
      [materialId],
    );
    if (materials.length === 0) {
      await connection.query(
        `INSERT INTO materials
         (material_id, type_id, title, fabricator, price_per_m2)
         VALUES (?, 'quartz', ?, 'Импорт', 0)`,
        [materialId, snapshot.stoneName || `Авто-камень (${materialId})`],
      );
    }

    const lengthMm = Math.round(Number(snapshot.length));
    const widthMm = Math.round(Number(snapshot.width));
    const areaM2 = Math.round((lengthMm * widthMm * 1000) / 1000000) / 1000;
    const edgeLengthM = Number(
      snapshot.isThickEdge ? snapshot.edge40 : snapshot.edge20,
    );
    if (items.length === 1) {
      await connection.query(
        `UPDATE order_items
         SET material_id = ?, length_mm = ?, width_mm = ?, area_m2 = ?,
             edge_profile_id = ?, edge_length_m = ?, item_cost = ?
         WHERE item_id = ?`,
        [
          materialId,
          lengthMm,
          widthMm,
          areaM2,
          edgeProfileId,
          edgeLengthM,
          totalAmount,
          items[0].item_id,
        ],
      );
    } else {
      await connection.query(
        `INSERT INTO order_items
         (order_id, product_type_id, material_id, length_mm, width_mm,
          area_m2, edge_profile_id, edge_length_m, item_cost)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          materialId,
          lengthMm,
          widthMm,
          areaM2,
          edgeProfileId,
          edgeLengthM,
          totalAmount,
        ],
      );
    }

    const [orderUpdate] = await connection.query(
      `UPDATE orders
       SET calculator_snapshot = ?, stone_name = ?, total_amount = ?,
           exchange_rate = ?, version = version + 1
       WHERE order_id = ? AND version = ?`,
      [
        JSON.stringify(snapshot),
        snapshot.stoneName || null,
        totalAmount,
        exchangeRate,
        orderId,
        expectedVersion,
      ],
    );
    if (orderUpdate.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Заказ был изменен другим пользователем",
      });
    }

    const totalRevenueCents = toCents(totalAmount);
    const prepaymentCents = toCents(currentOrder.prepayment);
    const balanceCents = totalRevenueCents - prepaymentCents;
    const calculationRate = exchangeRate || 3.2;
    const materialCostCents = Math.round(Number(snapshot.matUSD) * calculationRate * 100);
    const productionCostCents = Math.round(Number(snapshot.prodUSD) * calculationRate * 100);
    const stoneCategory = determineStoneCategory(materialId, snapshot);
    await connection.query(
      `INSERT INTO order_finances
       (order_id, stone_category, material_cost_cents, production_cost_cents,
        total_revenue_cents, prepayment_cents, balance_cents, currency,
        exchange_rate, calculation_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'BYN', ?, ?)
       ON DUPLICATE KEY UPDATE
         stone_category = VALUES(stone_category),
         material_cost_cents = VALUES(material_cost_cents),
         production_cost_cents = VALUES(production_cost_cents),
         total_revenue_cents = VALUES(total_revenue_cents),
         prepayment_cents = VALUES(prepayment_cents),
         balance_cents = VALUES(balance_cents),
         exchange_rate = VALUES(exchange_rate),
         calculation_snapshot = VALUES(calculation_snapshot)`,
      [
        orderId,
        stoneCategory,
        materialCostCents,
        productionCostCents,
        totalRevenueCents,
        prepaymentCents,
        balanceCents,
        exchangeRate,
        JSON.stringify(snapshot),
      ],
    );

    await logOrderAction(
      connection,
      orderId,
      "Обновление калькулятора",
      `Позиция, сумма и финансовый снимок обновлены; ${lengthMm}×${widthMm} мм`,
      req.user?.user_id,
    );
    await connection.commit();
    res.json({
      success: true,
      message: "Калькулятор и позиция заказа обновлены",
      version: Number(expectedVersion) + 1,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Ошибка обновления калькулятора:", error);
    res.status(500).json({ success: false, message: "Не удалось обновить калькулятор" });
  } finally {
    if (connection) connection.release();
  }
}

// Обновление статуса заказа
async function updateOrderStatus(req, res) {
  const orderId = req.params.id;
  const { status_id, comment, version: expectedVersion } = req.validatedBody;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [currentOrder] = await connection.query(
      "SELECT status_id, version FROM orders WHERE order_id = ? FOR UPDATE",
      [orderId],
    );

    if (currentOrder.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Заказ не найден" });
    }

    if (Number(currentOrder[0].version) !== Number(expectedVersion)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Заказ был изменен другим пользователем",
        current_version: Number(currentOrder[0].version),
      });
    }

    const currentStatus = currentOrder[0].status_id;
    if (
      !canTransition(currentStatus, status_id, {
        isAdmin: req.user?.role_id === 1,
      })
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Недопустимый переход статуса: ${currentStatus} → ${status_id}`,
      });
    }

    const [result] = await connection.query(
      `UPDATE orders
       SET status_id = ?, version = version + 1
       WHERE order_id = ? AND version = ?`,
      [status_id, orderId, expectedVersion],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res
        .status(409)
        .json({ success: false, message: "Заказ был изменен другим пользователем" });
    }

    await logOrderAction(
      connection,
      orderId,
      "Смена статуса",
      `Статус изменен: ${currentStatus} → ${status_id}${comment ? `. Комментарий: ${comment}` : ""}`,
      req.user?.user_id,
    );

    await connection.commit();
    res.json({
      success: true,
      message: "Статус успешно обновлен",
      version: Number(expectedVersion) + 1,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Ошибка обновления статуса:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера" });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getAllOrders,
  getProductionOrders,
  getOrderById,
  updateOrder,
  updateOrderCalculator,
  createOrder,
  updateOrderStatus,
  logOrderAction,
};
