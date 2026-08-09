const pool = require("./db");
const bcrypt = require("bcrypt");

async function setupUsers() {
  console.log("⏳ Запуск инициализации пользователей...");
  const saltRounds = 10;

  try {
    // 1. Отключаем проверку связей, очищаем и включаем обратно
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    await pool.query("DELETE FROM users");
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("🗑️ Старые пользователи успешно удалены.");

    // 2. Описываем новых пользователей, их логины и роли
    const newUsers = [
      {
        login: "admin",
        full_name: "Администратор PRO Камень",
        password: "mazda2877",
        role_id: 1, // Роль: Администратор
      },
      {
        login: "manager",
        full_name: "Ведущий Менеджер",
        password: "2877",
        role_id: 2, // Роль: Менеджер
      },
      {
        login: "worker",
        full_name: "Мастер Цеха (Рабочий)",
        password: "pro",
        role_id: 3, // Роль: Рабочий
      },
    ];

    // 3. Хешируем пароли и записываем каждого в MySQL
    for (const u of newUsers) {
      const hash = await bcrypt.hash(u.password, saltRounds);

      await pool.query(
        "INSERT INTO users (role_id, full_name, login, password_hash) VALUES (?, ?, ?, ?)",
        [u.role_id, u.full_name, u.login, hash],
      );

      console.log(`✅ Создан пользователь: ${u.login} (Пароль защищен)`);
    }

    console.log(
      "\n🚀 Все пользователи успешно добавлены в MySQL! Можно входить в CRM.",
    );
  } catch (error) {
    console.error("❌ Ошибка при инициализации базы:", error);
  } finally {
    process.exit(); // Закрываем процесс
  }
}

setupUsers();
