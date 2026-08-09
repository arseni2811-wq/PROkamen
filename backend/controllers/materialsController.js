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

// Создание материала
async function createMaterial(req, res) {
  const validatedData = req.validatedBody;

  try {
    const normalizedTypeId = validatedData.type_id ?? null;
    const normalizedFabricator = validatedData.fabricator ?? null;

    let query =
      "INSERT INTO materials (type_id, title, fabricator, price_per_m2) VALUES (?, ?, ?, ?)";
    let values = [
      normalizedTypeId,
      validatedData.title.trim(),
      normalizedFabricator,
      validatedData.price_per_m2,
    ];

    if (
      validatedData.material_id !== undefined &&
      validatedData.material_id !== null &&
      validatedData.material_id !== ""
    ) {
      query =
        "INSERT INTO materials (material_id, type_id, title, fabricator, price_per_m2) VALUES (?, ?, ?, ?, ?)";
      values = [
        validatedData.material_id,
        normalizedTypeId,
        validatedData.title.trim(),
        normalizedFabricator,
        validatedData.price_per_m2,
      ];
    }

    const [result] = await pool.query(query, values);
    res.json({
      success: true,
      message: "Материал успешно добавлен",
      material: {
        material_id: result.insertId,
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
    const [result] = await pool.query(
      "UPDATE materials SET type_id = ?, title = ?, fabricator = ?, price_per_m2 = ? WHERE material_id = ?",
      [
        validatedData.type_id ?? null,
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
