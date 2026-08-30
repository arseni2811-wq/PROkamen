const fs = require("fs");
const path = require("path");
const pool = require("../db");

function parseDimensions(value) {
  const match = String(value || "").match(/(\d+)\s*[×xх]\s*(\d+)\s*[×xх]\s*(\d+)/i);
  return match
    ? { lengthMm: Number(match[1]), widthMm: Number(match[2]), thicknessMm: Number(match[3]) }
    : { lengthMm: null, widthMm: null, thicknessMm: null };
}

async function importCalculatorCatalog() {
  if (process.env.ALLOW_CATALOG_IMPORT !== "1") {
    throw new Error("Set ALLOW_CATALOG_IMPORT=1 after taking a database backup");
  }
  const catalogPath = path.join(__dirname, "..", "..", "public", "assets", "data", "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [formats] = await connection.query(
      "SELECT format_id, system_code, length_mm, width_mm FROM calculator_slab_formats",
    );
    for (const [index, item] of catalog.entries()) {
      const dimensions = parseDimensions(item.sizeMm);
      const format = formats.find((entry) =>
        Number(entry.length_mm) === dimensions.lengthMm &&
        Number(entry.width_mm) === dimensions.widthMm,
      );
      await connection.query(
        `INSERT INTO materials
         (material_id, type_id, title, fabricator, description, image_path, sku,
          slab_format_id, length_mm, width_mm, thickness_mm, price_unit,
          base_price_usd_cents, is_active, public_available, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 0, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           type_id = VALUES(type_id), title = VALUES(title),
           fabricator = VALUES(fabricator), description = VALUES(description),
           image_path = VALUES(image_path), sku = VALUES(sku),
           slab_format_id = COALESCE(VALUES(slab_format_id), slab_format_id),
           length_mm = COALESCE(VALUES(length_mm), length_mm),
           width_mm = COALESCE(VALUES(width_mm), width_mm),
           thickness_mm = COALESCE(VALUES(thickness_mm), thickness_mm),
           public_available = VALUES(public_available), sort_order = VALUES(sort_order)`,
        [
          item.id, item.type, item.title, item.fabricator || null,
          item.desc || null, item.image || null, item.id,
          format?.format_id || null, dimensions.lengthMm, dimensions.widthMm,
          dimensions.thicknessMm, item.type === "marble" ? 0 : 1, index * 10 + 10,
        ],
      );
    }
    await connection.commit();
    return catalog.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  importCalculatorCatalog()
    .then((count) => console.log(`Imported ${count} catalog materials`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { importCalculatorCatalog, parseDimensions };
