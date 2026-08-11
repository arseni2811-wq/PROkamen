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
const clientsRoutes = require("./routes/clients.routes");

// =========================================================
// HEALTH-CHECK (JSON)
// Должен быть ЗАРЕГИСТРИРОВАН ДО app.use("/api", ordersRoutes):
// иначе GET /api/health ловит роут "/:id" и требует JWT-токен.
// =========================================================
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, status: "ok", db: "connected" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, status: "error", message: err.message });
  }
});

app.use("/api", authRoutes);
// ВАЖНО: ordersRoutes монтируется на /api/orders, потому что внутри
// orders.routes.js эндпоинты написаны относительно корня роутера:
//   router.post("/")  → POST  /api/orders
//   router.get("/:id") → GET   /api/orders/123
// Если монтировать на /api, то POST /api/orders превращается во
// внутренний путь "/orders", который не совпадает ни с одним роутом →
// fallback отвечает "API endpoint not found: POST /api/orders".
app.use("/api/orders", ordersRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api", materialsRoutes);
app.use("/api", settingsRoutes);

// =========================================================
// РАЗДАЧА СТАТИКИ ФРОНТЕНДА
// Папка public становится корневой (замена Live Server):
//   http://localhost:3000/            → public/index.html
//   http://localhost:3000/js/app.js   → public/js/app.js
// ВАЖНО: путь — абсолютный, через path.join(__dirname, "..", "public"),
// т.е. от папки файла server.js, а не от текущего process.cwd().
// =========================================================
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// ----- Отладочный логгер статики (включить: DEBUG_STATIC=1 node server.js)
// Показывает, какой URL реально запрашивает браузер и существует ли
// файл с таким путём на диске.
if (process.env.DEBUG_STATIC === "1") {
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/uploads/") ||
      req.path.startsWith("/php")
    ) {
      return next();
    }

    const diskPath = path.join(PUBLIC_DIR, req.path);
    const exists = fs.existsSync(diskPath);

    res.on("finish", () => {
      console.log(
        `[static] ${req.method} ${req.originalUrl} → ${diskPath} ` +
          `(на диске: ${exists ? "ДА" : "НЕТ"}, ответ: ${res.statusCode}, ` +
          `${res.getHeader("content-type") || ""})`,
      );
    });
    next();
  });
}

// PHP-скрипты Node.js не исполняет, а config.php содержит SMTP-доступ,
// поэтому блокируем каталог ДО express.static (иначе статика отдаст
// файл браузеру как обычный текст)
app.use("/php", (req, res) => res.status(404).send("Not found"));

app.use(express.static(PUBLIC_DIR, { index: "index.html" }));

// =========================================================
// FALLBACK-РОУТ (замена правилам .htaccess, которые Node
// игнорирует).
//
//   /api/*                       → JSON 404 (API не трогаем)
//   *.css, *.js, *.jpg, *.png,
//   *.csv и любой файл с «.»     → пропускаем → жёсткий 404
//   остальные GET/HEAD           → public/index.html (страницы SPA)
//
// В Express 5 нельзя использовать app.get("*") — wildcard-строки
// убраны, поэтому используем app.use().
// =========================================================
const PRETTY_URLS = {
  "/catalog": "/pages/catalog.html",
  "/services": "/pages/services.html",
  "/works": "/pages/works.html",
  "/about": "/pages/about.html",
  "/contacts": "/pages/contacts.html",
};

app.use((req, res, next) => {
  // API-запросы к несуществующим эндпоинтам → JSON 404
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.path}`,
    });
  }

  // Запросы к загрузкам не трогаем
  if (req.path.startsWith("/uploads/")) {
    return next();
  }

  // Не-GET запросы отдаём на дефолтный 404 Express
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  // Главная защита: запросы к файлам с расширением НЕ подменяем
  // index.html — браузер должен получить честный 404, а не HTML.
  if (path.extname(req.path) !== "") {
    return next();
  }

  // ЧПУ-редиректы из .htaccess: /catalog/ → /pages/catalog.html
  const cleanPath = req.path.replace(/\/+$/, "") || "/";
  const prettyTarget = PRETTY_URLS[cleanPath];
  if (prettyTarget) {
    return res.redirect(301, prettyTarget);
  }

  // SPA-fallback: «страничные» пути → index.html
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

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
// Health-check перенесён на GET /api/health (см. секцию
// «Раздача статики»), потому что "/" теперь отдаёт index.html.

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

    // Дополнительные колонки заказа (ШАГ 4: Источник, Камень)
    const [sourceCols] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'order_source'",
    );
    if (sourceCols.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN order_source VARCHAR(255) NULL COMMENT 'Источник заявки'",
      );
    }

    const [stoneCols] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'stone_name'",
    );
    if (stoneCols.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN stone_name VARCHAR(255) NULL COMMENT 'Выбранный камень'",
      );
    }

    const [deadlinesCols] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'deadlines'",
    );
    if (deadlinesCols.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN deadlines JSON NULL COMMENT 'График работ и дедлайны'",
      );
    }

    // Дополнительные колонки клиента (ШАГ 4: Адрес, Соц. сети)
    const [addressCols] = await pool.query(
      "SHOW COLUMNS FROM clients LIKE 'address'",
    );
    if (addressCols.length === 0) {
      await pool.query(
        "ALTER TABLE clients ADD COLUMN address VARCHAR(500) NULL COMMENT 'Адрес клиента'",
      );
    }

    const [socialCols] = await pool.query(
      "SHOW COLUMNS FROM clients LIKE 'social_networks'",
    );
    if (socialCols.length === 0) {
      await pool.query(
        "ALTER TABLE clients ADD COLUMN social_networks VARCHAR(500) NULL COMMENT 'Соц. сети / Мессенджер'",
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

    // Таблица журнала действий по заказам (Журнал действий)
    const [histTables] = await pool.query(
      "SHOW TABLES LIKE 'order_history_log'",
    );
    if (histTables.length === 0) {
      await pool.query(`
        CREATE TABLE order_history_log (
          log_id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          description VARCHAR(500) NULL,
          user_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
          INDEX idx_history_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log("✅ Таблица order_history_log создана");
    }

    console.log("✅ Все индексы БД созданы");

    // Синхронизация справочника статусов с фронтендом канбана
    const { ensureOrderStatuses } = require("./utils/seedStatuses");
    await ensureOrderStatuses(pool);
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
    console.log(
      `📄 Статика: ${PUBLIC_DIR} (fallback: index.html для страниц, 404 для *.css/*.js/*.jpg/*.csv)`,
    );
  });
});
