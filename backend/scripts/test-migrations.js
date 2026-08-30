const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ quiet: true });
const { runMigrations } = require("./migrate");
const { adoptBaseline } = require("./adopt-baseline");

async function main() {
  const database = `prokamen_migration_test_${Date.now()}`;
  const legacyDatabase = `prokamen_legacy_test_${Date.now()}`;
  if (!/^prokamen_migration_test_\d+$/.test(database)) {
    throw new Error("Unsafe test database name");
  }
  if (!/^prokamen_legacy_test_\d+$/.test(legacyDatabase)) {
    throw new Error("Unsafe legacy test database name");
  }
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query(`CREATE DATABASE \`${legacyDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    process.env.ALLOW_SCHEMA_MIGRATIONS = "1";
    await runMigrations({ database });
    await runMigrations({ database });

    const check = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database,
    });
    try {
      const [statusRows] = await check.query(
        "SELECT COUNT(*) AS count FROM dict_order_statuses WHERE status_id = 'lead'",
      );
      const [uniqueRows] = await check.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_finances'
           AND INDEX_NAME = 'uq_order_finances_order' AND NON_UNIQUE = 0`,
        [database],
      );
      const [migrationRows] = await check.query(
        "SELECT COUNT(*) AS count FROM schema_migrations",
      );
      const [versionRows] = await check.query(
        `SELECT COLUMN_DEFAULT, IS_NULLABLE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'version'`,
        [database],
      );
      const [idempotencyRows] = await check.query(
        `SELECT COUNT(*) AS column_count
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_idempotency_keys'
           AND INDEX_NAME = 'uq_order_idempotency_actor_key' AND NON_UNIQUE = 0
         GROUP BY INDEX_NAME`,
        [database],
      );
      const [calculatorTables] = await check.query(
        "SHOW TABLES LIKE 'calculator_pricebooks'",
      );
      const [calculatorRates] = await check.query(
        "SELECT COUNT(*) AS count FROM calculator_rates",
      );
      if (
        statusRows[0].count !== 1 ||
        uniqueRows[0].count !== 1 ||
        migrationRows[0].count !== 5 ||
        versionRows.length !== 1 ||
        Number(versionRows[0].COLUMN_DEFAULT) !== 1 ||
        versionRows[0].IS_NULLABLE !== "NO" ||
        idempotencyRows.length !== 1 ||
        idempotencyRows[0].column_count !== 2 ||
        calculatorTables.length !== 1 ||
        Number(calculatorRates[0].count) < 30
      ) {
        throw new Error(
          `Migration verification failed: ${JSON.stringify({
            status: statusRows[0],
            finance_unique: uniqueRows[0],
            migrations: migrationRows[0],
            version: versionRows[0],
            idempotency_unique: idempotencyRows[0],
            calculator_rates: calculatorRates[0],
          })}`,
        );
      }
      console.log(
        JSON.stringify({
          success: true,
          database,
          migrations: migrationRows[0].count,
          lead_status: true,
          unique_order_finance: true,
          orders_version: true,
          idempotency_unique: true,
          calculator_pricebook: true,
          rerun_idempotent: true,
        }),
      );
    } finally {
      await check.end();
    }

    const legacy = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: legacyDatabase,
      multipleStatements: true,
    });
    try {
      const baselineSql = fs.readFileSync(
        path.resolve(__dirname, "../migrations/001_baseline.sql"),
        "utf8",
      );
      await legacy.query(baselineSql);
    } finally {
      await legacy.end();
    }
    process.env.ALLOW_BASELINE_ADOPTION = "1";
    await adoptBaseline({ database: legacyDatabase });
    await runMigrations({ database: legacyDatabase });
    const legacyCheck = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: legacyDatabase,
    });
    try {
      const [legacyMigrations] = await legacyCheck.query(
        "SELECT COUNT(*) AS count FROM schema_migrations",
      );
      const [legacyVersion] = await legacyCheck.query(
        "SHOW COLUMNS FROM orders LIKE 'version'",
      );
      const [legacyIdempotency] = await legacyCheck.query(
        "SHOW TABLES LIKE 'order_idempotency_keys'",
      );
      if (
        legacyMigrations[0].count !== 5 ||
        legacyVersion.length !== 1 ||
        legacyIdempotency.length !== 1
      ) {
        throw new Error("Legacy baseline adoption verification failed");
      }
      console.log(
        JSON.stringify({
          success: true,
          database: legacyDatabase,
          baseline_adoption: true,
          incremental_migrations: 4,
        }),
      );
    } finally {
      await legacyCheck.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.query(`DROP DATABASE IF EXISTS \`${legacyDatabase}\``);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
