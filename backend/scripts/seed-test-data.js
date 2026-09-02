const bcrypt = require("bcrypt");
const pool = require("../db");

const databaseName = process.env.DB_DATABASE || process.env.DB_NAME;

async function seedTestData() {
  if (databaseName !== "pro_erp_test") {
    throw new Error("Test seed is allowed only for DB_DATABASE=pro_erp_test");
  }
  if (!process.env.TEST_ADMIN_PASSWORD) {
    throw new Error("TEST_ADMIN_PASSWORD is required for the test seed");
  }

  await pool.query(
    `INSERT INTO dict_roles (role_id, role_name, description)
     VALUES (1, 'admin', 'Test administrator')
     ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), description = VALUES(description)`,
  );

  const passwordHash = await bcrypt.hash(process.env.TEST_ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (role_id, full_name, login, password_hash)
     VALUES (1, 'Test Administrator', 'test-admin', ?)
     ON DUPLICATE KEY UPDATE
       role_id = VALUES(role_id),
       full_name = VALUES(full_name),
       password_hash = VALUES(password_hash)`,
    [passwordHash],
  );

  console.log("Test administrator seeded for pro_erp_test");
}

seedTestData()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
