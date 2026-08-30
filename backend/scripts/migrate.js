const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

async function runMigrations({ database = process.env.DB_DATABASE } = {}) {
  if (process.env.ALLOW_SCHEMA_MIGRATIONS !== "1") {
    throw new Error("Set ALLOW_SCHEMA_MIGRATIONS=1 to run schema migrations");
  }
  if (!database) throw new Error("DB_DATABASE is required");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    multipleStatements: true,
  });

  try {
    const [ordersBeforeMigration] = await connection.query(
      "SHOW TABLES LIKE 'orders'",
    );
    const [migrationTables] = await connection.query(
      "SHOW TABLES LIKE 'schema_migrations'",
    );
    if (ordersBeforeMigration.length > 0 && migrationTables.length === 0) {
      throw new Error(
        "Existing database is not versioned. Run the guarded baseline adoption command before migrations.",
      );
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const migrationsDir = path.resolve(__dirname, "../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => /^\d{3}_.+\.sql$/.test(name))
      .sort();
    const [appliedRows] = await connection.query(
      "SELECT migration_name FROM schema_migrations",
    );
    const applied = new Set(appliedRows.map((row) => row.migration_name));
    const [existingOrders] = await connection.query("SHOW TABLES LIKE 'orders'");
    if (applied.size === 0 && existingOrders.length > 0) {
      throw new Error(
        "Existing database is not versioned. Run the guarded baseline adoption command before migrations.",
      );
    }

    for (const filename of files) {
      if (applied.has(filename)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      await connection.query(sql);
      await connection.query(
        "INSERT INTO schema_migrations (migration_name) VALUES (?)",
        [filename],
      );
      console.log(`Applied ${filename}`);
    }
    return files;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { runMigrations };
