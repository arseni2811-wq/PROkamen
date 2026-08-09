const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const pool = require("./db");

const app = express();
const port = 3000;

// =========================================================
// КОНФИГУРАЦИЯ
// =========================================================
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_crm_key";
const ALLOWED_ORIGINS = (
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501,http://localhost:3000,http://127.0.0.1:3000"
).split(",");

const ROLES = {
  ADMIN: 1,
  MANAGER: 2,
  WORKER: 3,
};

// =========================================================
// MIDDLEWARE
// =========================================================
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Раздача статики для загруженных файлов
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =========================================================
// ПОДКЛЮЧЕНИЕ МАРШРУТОВ
// =========================================================
const authRoutes = require("./routes/auth.routes");
const ordersRoutes = require("./routes/orders.routes");
const materialsRoutes = require("./routes/materials.routes");
const settingsRoutes = require("./routes/settings.routes");

app.use("/api", authRoutes);
app.use("/api", ordersRoutes);
app.use("/api", materialsRoutes);
app.use("/api", settingsRoutes);

// =========================================================
// ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК
// =========================================================
app.use((err, req, res, next) => {
  console.error("❌ Глобальная ошибка:", err);

  // Zod validation error
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Ошибка валидации данных",
      errors: err.errors,
    });
  }

  // Database error
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Запись с таким идентификатором уже существует",
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Внутренняя ошибка сервера",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Обработка необработанных Promise rejections
process.on("UnhandledPromiseRejection", (err) => {
  console.error("❌ Необработанная ошибка Promise:", err);
  // В production здесь можно добавить уведомление админу
});

process.on("uncaughtException", (err) => {
  console.error("❌ Неперехваченное исключение:", err);
  // Критическая ошибка - graceful shutdown
  process.exit(1);
});

// =========================================================
// ПУБЛИЧНЫЕ МАРШРУТЫ (без аутентификации)
// =========================================================

// 1. ПРОВЕРКА ПОДКЛЮЧЕНИЯ К БД
app.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1");
    res.send("Сервер работает! Подключение к БД успешно.");
  } catch (err) {
    res.status(500).send("Ошибка подключения к базе данных: " + err.message);
  }
});

// =========================================================
// ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ
// =========================================================
async function ensureDatabaseSchema() {
  try {
    // Колонки для orders
    const [exchangeRows] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'exchange_rate'",
    );
    if (exchangeRows.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN exchange_rate DECIMAL(10,4) NULL",
      );
    }

    const [snapshotRows] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'calculator_snapshot'",
    );
    if (snapshotRows.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN calculator_snapshot LONGTEXT NULL",
      );
    }

    const [prepaymentRows] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'prepayment'",
    );
    if (prepaymentRows.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN prepayment DECIMAL(10,2) NULL DEFAULT 0.00",
      );
    }

    // Таблица order_attachments
    const [attachTables] = await pool.query(
      "SHOW TABLES LIKE 'order_attachments'",
    );
    if (attachTables.length === 0) {
      await pool.query(`
        CREATE TABLE order_attachments (
          attachment_id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_type ENUM('document', 'photo') NOT NULL DEFAULT 'document',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log("✅ Таблица order_attachments создана");
    }

    // Таблица system_settings
    const [settingsTables] = await pool.query(
      "SHOW TABLES LIKE 'system_settings'",
    );
    if (settingsTables.length === 0) {
      await pool.query(`
        CREATE TABLE system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('exchange_rate', '3.2')",
      );
      console.log("✅ Таблица system_settings создана");
    }

    // Таблица order_finances
    const [financeTables] = await pool.query(
      "SHOW TABLES LIKE 'order_finances'",
    );
    if (financeTables.length === 0) {
      await pool.query(`
        CREATE TABLE order_finances (
          finance_id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          stone_category ENUM('acrylic', 'quartz', 'other') NOT NULL DEFAULT 'other',
          material_cost_cents INT NOT NULL DEFAULT 0,
          production_cost_cents INT NOT NULL DEFAULT 0,
          total_revenue_cents INT NOT NULL DEFAULT 0,
          prepayment_cents INT NOT NULL DEFAULT 0,
          balance_cents INT NOT NULL DEFAULT 0,
          currency VARCHAR(3) NOT NULL DEFAULT 'BYN',
          exchange_rate DECIMAL(10,4) NULL,
          calculation_snapshot JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
          INDEX idx_order_finance_order (order_id),
          INDEX idx_order_finance_category (stone_category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log("✅ Таблица order_finances создана");
    }

    // Колонка stone_category в order_items
    const [categoryCols] = await pool.query(
      "SHOW COLUMNS FROM order_items LIKE 'stone_category'",
    );
    if (categoryCols.length === 0) {
      await pool.query(`
        ALTER TABLE order_items 
        ADD COLUMN stone_category ENUM('acrylic', 'quartz', 'other') DEFAULT 'other' 
        COMMENT 'Категория камня для финансового учета' 
        AFTER material_id
      `);
      await pool.query(
        "CREATE INDEX idx_order_items_category ON order_items(stone_category)",
      );
      console.log("✅ Колонка stone_category добавлена в order_items");
    }

    // ИНДЕКСЫ для ускорения запросов
    console.log("🔧 Создание индексов БД...");

    const [statusIdx] = await pool.query(
      "SHOW INDEX FROM orders WHERE Key_name = 'idx_status'",
    );
    if (statusIdx.length === 0) {
      await pool.query("CREATE INDEX idx_status ON orders(status_id)");
      console.log("✅ Индекс idx_status создан");
    }

    const [clientIdx] = await pool.query(
      "SHOW INDEX FROM orders WHERE Key_name = 'idx_client'",
    );
    if (clientIdx.length === 0) {
      await pool.query("CREATE INDEX idx_client ON orders(client_id)");
      console.log("✅ Индекс idx_client создан");
    }

    const [managerIdx] = await pool.query(
      "SHOW INDEX FROM orders WHERE Key_name = 'idx_manager'",
    );
    if (managerIdx.length === 0) {
      await pool.query("CREATE INDEX idx_manager ON orders(manager_id)");
      console.log("✅ Индекс idx_manager создан");
    }

    const [orderItemIdx] = await pool.query(
      "SHOW INDEX FROM order_items WHERE Key_name = 'idx_order'",
    );
    if (orderItemIdx.length === 0) {
      await pool.query("CREATE INDEX idx_order ON order_items(order_id)");
      console.log("✅ Индекс idx_order создан");
    }

    const [phoneIdx] = await pool.query(
      "SHOW INDEX FROM clients WHERE Key_name = 'idx_phone'",
    );
    if (phoneIdx.length === 0) {
      await pool.query("CREATE INDEX idx_phone ON clients(phone)");
      console.log("✅ Индекс idx_phone создан");
    }

    console.log("✅ Все индексы БД созданы");
  } catch (error) {
    console.error("Ошибка инициализации схемы БД:", error);
  }
}

// =========================================================
// ЗАПУСК СЕРВЕРА
// =========================================================
ensureDatabaseSchema().finally(() => {
  app.listen(port, () => {
    console.log(`🚀 Защищенный бэкенд запущен: http://localhost:${port}`);
    console.log(`🔒 JWT-аутентификация активна`);
    console.log(`🔐 Ролевая модель защищена (ADMIN=1, MANAGER=2, WORKER=3)`);
    console.log(`✅ Zod-валидация активна для всех мутирующих эндпоинтов`);
    console.log(`✅ State Machine для статусов заказов активна`);
    console.log(`✅ Финансовые расчеты в целых числах (центы)`);
    console.log(`✅ Модульная архитектура (routes, controllers, middleware)`);
    console.log(
      `🌐 Разрешённые frontend-адреса: ${ALLOWED_ORIGINS.join(", ")}`,
    );
    console.log(`📁 Загрузка файлов: /uploads/orders/`);
  });
});
