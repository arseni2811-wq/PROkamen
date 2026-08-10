const pool = require("../db");
const { materialSchema, servicesSchema } = require("../middleware/schemas");

// Получение всех материалов
async function getMaterials(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT material_id, type_id, title, fabricator, price_per_m2 FROM materials ORDER BY title ASC",
    );
    res.json({ success: true, materials: rows });
  } catch (error) {
    console.error("Ошибка при получении материалов:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Тип материала по умолчанию (обязано существовать в dict_material_types)
const FALLBACK_TYPE_ID = "quartz";

// Приводит любое значение type_id к валидному ключу справочника
// dict_material_types (иначе INSERT падает с FK-ошибкой → 500).
async function resolveValidTypeId(typeId) {
  const requested =
    typeId === null || typeId === undefined ? "" : String(typeId).trim();
  if (requested) {
    try {
      const [rows] = await pool.query(
        "SELECT type_id FROM dict_material_types WHERE type_id = ?",
        [requested],
      );
      if (rows.length > 0) return rows[0].type_id;
    } catch (error) {
      console.error("Ошибка проверки type_id:", error);
    }
  }
  return FALLBACK_TYPE_ID;
}

// Создание материала
async function createMaterial(req, res) {
  const validatedData = req.validatedBody;

  try {
    // materials.material_id — VARCHAR PRIMARY KEY без AUTO_INCREMENT:
    // если фронтенд не прислал ID, генерируем уникальный вместо NULL,
    // иначе INSERT падает с "Field 'material_id' doesn't have a default value".
    const materialId =
      validatedData.material_id !== undefined &&
      validatedData.material_id !== null &&
      String(validatedData.material_id).trim() !== ""
        ? String(validatedData.material_id).trim()
        : `auto_${Date.now()}`;

    // Дубликат ключа → понятный 409 вместо сырой Error 500
    const [existingRows] = await pool.query(
      "SELECT material_id FROM materials WHERE material_id = ?",
      [materialId],
    );
    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Материал с ID «${materialId}» уже существует в базе`,
      });
    }

    const normalizedTypeId = await resolveValidTypeId(validatedData.type_id);
    const normalizedFabricator = validatedData.fabricator ?? null;

    await pool.query(
      "INSERT INTO materials (material_id, type_id, title, fabricator, price_per_m2) VALUES (?, ?, ?, ?, ?)",
      [
        materialId,
        normalizedTypeId,
        validatedData.title.trim(),
        normalizedFabricator,
        validatedData.price_per_m2,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Материал успешно добавлен",
      material: {
        material_id: materialId,
        type_id: normalizedTypeId,
        title: validatedData.title.trim(),
        fabricator: normalizedFabricator,
        price_per_m2: validatedData.price_per_m2,
      },
    });
  } catch (error) {
    console.error("Ошибка при добавлении материала:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Обновление материала
async function updateMaterial(req, res) {
  const materialId = req.params.id;
  const validatedData = req.validatedBody;

  try {
    const normalizedTypeId = await resolveValidTypeId(validatedData.type_id);
    const [result] = await pool.query(
      "UPDATE materials SET type_id = ?, title = ?, fabricator = ?, price_per_m2 = ? WHERE material_id = ?",
      [
        normalizedTypeId,
        validatedData.title.trim(),
        validatedData.fabricator ?? null,
        validatedData.price_per_m2,
        materialId,
      ],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Материал не найден" });
    }

    res.json({ success: true, message: "Материал успешно обновлен" });
  } catch (error) {
    console.error("Ошибка при обновлении материала:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Удаление материала
async function deleteMaterial(req, res) {
  const materialId = req.params.id;

  try {
    const [result] = await pool.query(
      "DELETE FROM materials WHERE material_id = ?",
      [materialId],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Материал не найден" });
    }

    res.json({ success: true, message: "Материал удален" });
  } catch (error) {
    console.error("Ошибка при удалении материала:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Получение услуг
async function getServices(req, res) {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'dict_services'");
    if (tables.length === 0) {
      return res.json({ success: true, services: {} });
    }

    const [rows] = await pool.query(
      "SELECT service_name, price_per_unit FROM dict_services",
    );
    const services = {};

    rows.forEach((row) => {
      if (row.service_name) {
        const key = row.service_name
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_]/g, "")
          .toLowerCase();
        services[key] = Number(row.price_per_unit) || 0;
      }
    });

    res.json({ success: true, services });
  } catch (error) {
    console.error("Ошибка при получении прайса услуг:", error);
    res.json({ success: true, services: {} });
  }
}

// Обновление услуг
async function updateServices(req, res) {
  const validatedData = req.validatedBody;
  const incomingServices = validatedData.services || {};

  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'dict_services'");
    if (tables.length === 0) {
      return res.json({
        success: true,
        services: incomingServices,
      });
    }

    for (const [serviceKey, value] of Object.entries(incomingServices)) {
      const numericValue = Number(value) || 0;
      const [existing] = await pool.query(
        "SELECT service_key FROM dict_services WHERE service_key = ?",
        [serviceKey],
      );

      if (existing.length > 0) {
        await pool.query(
          "UPDATE dict_services SET price = ? WHERE service_key = ?",
          [numericValue, serviceKey],
        );
      } else {
        await pool.query(
          "INSERT INTO dict_services (service_key, price) VALUES (?, ?)",
          [serviceKey, numericValue],
        );
      }
    }

    res.json({ success: true, services: incomingServices });
  } catch (error) {
    console.error("Ошибка при обновлении прайса услуг:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getServices,
  updateServices,
};
