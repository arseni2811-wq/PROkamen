const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

const REQUIRED_TABLES = [
  "dict_roles",
  "users",
  "clients",
  "dict_order_statuses",
  "dict_material_types",
  "dict_product_types",
  "dict_edge_profiles",
  "materials",
  "orders",
  "order_items",
  "order_attachments",
  "order_history_log",
  "order_finances",
  "system_settings",
];

async function adoptBaseline({ database = process.env.DB_DATABASE } = {}) {
  if (process.env.ALLOW_BASELINE_ADOPTION !== "1") {
    throw new Error("Set ALLOW_BASELINE_ADOPTION=1 to adopt an existing schema");
  }
  if (!database) throw new Error("DB_DATABASE is required");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });
  try {
    const [tables] = await connection.query(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?`,
      [database],
    );
    const existing = new Set(tables.map((row) => row.TABLE_NAME));
    const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));
    if (missing.length > 0) {
      throw new Error(`Cannot adopt baseline; missing tables: ${missing.join(", ")}`);
    }
    const [futureColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'version'`,
      [database],
    );
    if (futureColumns.length > 0 || existing.has("order_idempotency_keys")) {
      throw new Error(
        "Cannot auto-adopt a partially migrated schema; reconcile schema_migrations manually",
      );
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT migration_name FROM schema_migrations FOR UPDATE",
    );
    if (rows.length > 0) {
      throw new Error("schema_migrations is not empty; baseline adoption refused");
    }
    await connection.query(
      "INSERT INTO schema_migrations (migration_name) VALUES ('001_baseline.sql')",
    );
    await connection.commit();
    console.log("Adopted existing schema as 001_baseline.sql");
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  adoptBaseline().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { adoptBaseline };
