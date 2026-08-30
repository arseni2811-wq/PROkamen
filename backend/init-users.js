const pool = require("./db");
const bcrypt = require("bcrypt");

async function setupUsers() {
  if (process.env.ALLOW_USER_RESEED !== "1") {
    throw new Error(
      "User seeding is disabled. Set ALLOW_USER_RESEED=1 explicitly.",
    );
  }
  console.log("⏳ Запуск инициализации пользователей...");
  const saltRounds = 10;

  const requiredPasswords = {
    admin: process.env.PROKAMEN_ADMIN_PASSWORD,
    manager: process.env.PROKAMEN_MANAGER_PASSWORD,
    worker: process.env.PROKAMEN_WORKER_PASSWORD,
  };
  const missing = Object.entries(requiredPasswords)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing password environment variables for: ${missing.join(", ")}`);
  }

  try {
    // Существующие связанные пользователи не удаляются: скрипт обновляет
    // только три явно названные учётные записи.
    const newUsers = [
      {
        login: "admin",
        full_name: "Администратор PRO Камень",
        password: requiredPasswords.admin,
        role_id: 1, // Роль: Администратор
      },
      {
        login: "manager",
        full_name: "Ведущий Менеджер",
        password: requiredPasswords.manager,
        role_id: 2, // Роль: Менеджер
      },
      {
        login: "worker",
        full_name: "Мастер Цеха (Рабочий)",
        password: requiredPasswords.worker,
        role_id: 3, // Роль: Рабочий
      },
    ];

    // 3. Хешируем пароли и записываем каждого в MySQL
    for (const u of newUsers) {
      const hash = await bcrypt.hash(u.password, saltRounds);

      await pool.query(
        `INSERT INTO users (role_id, full_name, login, password_hash)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           role_id = VALUES(role_id),
           full_name = VALUES(full_name),
           password_hash = VALUES(password_hash)`,
        [u.role_id, u.full_name, u.login, hash],
      );

      console.log(`✅ Создан пользователь: ${u.login} (Пароль защищен)`);
    }

    console.log(
      "\n🚀 Все пользователи успешно добавлены в MySQL! Можно входить в CRM.",
    );
  } catch (error) {
    console.error("❌ Ошибка при инициализации базы:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupUsers().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
