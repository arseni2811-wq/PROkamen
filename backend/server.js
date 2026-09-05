const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const { authenticateJWT } = require("./middleware/auth");
const { authorize } = require("./middleware/authorize");
const { requestContext } = require("./middleware/requestContext");
const { authorizeAttachmentDownload } = require("./middleware/orderAccess");

const app = express();
const port = Number(process.env.PORT || 3000);
const databaseName = process.env.DB_DATABASE || process.env.DB_NAME;

if (
  process.platform === "win32" &&
  ["development", "test"].includes(process.env.NODE_ENV) &&
  databaseName !== "pro_erp_test"
) {
  throw new Error(
    "Для локальной Windows-разработки разрешена только база pro_erp_test",
  );
}

// =========================================================
// КОНФИГУРАЦИЯ
// =========================================================
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
app.use(requestContext);
app.use(express.json());
app.use(cookieParser());

// Вложения заказов содержат клиентские данные и не должны быть публичной
// статикой. Ссылка из CRM открывается с той же httpOnly cookie.
app.use(
  "/uploads",
  authenticateJWT,
  authorizeAttachmentDownload,
  express.static(process.env.UPLOADS_DIR || path.join(__dirname, "uploads")),
);

// =========================================================
// ПОДКЛЮЧЕНИЕ МАРШРУТОВ
// =========================================================
const authRoutes = require("./routes/auth.routes");
const ordersRoutes = require("./routes/orders.routes");
const materialsRoutes = require("./routes/materials.routes");
const settingsRoutes = require("./routes/settings.routes");
const clientsRoutes = require("./routes/clients.routes");
const calculatorRoutes = require("./routes/calculator.routes");
const portfolioRoutes = require("./routes/portfolio.routes");

// =========================================================
// HEALTH-CHECK (JSON)
// Должен быть ЗАРЕГИСТРИРОВАН ДО app.use("/api", ordersRoutes):
// иначе GET /api/health ловит роут "/:id" и требует JWT-токен.
// =========================================================
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      success: true,
      status: "ok",
      db: "connected",
      database: "connected",
      dbName: databaseName,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, status: "error", message: "Database unavailable" });
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
app.use("/api", calculatorRoutes);
app.use("/api/admin/portfolio", portfolioRoutes);

// =========================================================
// РАЗДАЧА СТАТИКИ ФРОНТЕНДА
// Папка public становится корневой (замена Live Server):
//   http://localhost:3000/            → public/index.html
//   http://localhost:3000/js/app.js   → public/js/app.js
// ВАЖНО: путь — абсолютный, через path.join(__dirname, "..", "public"),
// т.е. от папки файла server.js, а не от текущего process.cwd().
// =========================================================
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PROJECT_SLUGS = require("../public/assets/data/project-slugs.json");

// Служебные HTML-страницы исключаем из индексации также HTTP-заголовком.
// Это дополняет meta robots и продолжает работать для ответов 401/403.
function setPrivateNoIndexHeaders(req, res, next) {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Cache-Control", "private, no-store");
  next();
}

app.use("/crm", setPrivateNoIndexHeaders);

// Внутренний прайс и его CSV-источник доступны только администратору.
app.get(
  ["/pages/price.html", "/assets/data/price.csv"],
  setPrivateNoIndexHeaders,
  authenticateJWT,
  authorize(ROLES.ADMIN),
);

// HTML административной страницы доступен только администратору CRM.
app.get(
  "/pages/admin.html",
  setPrivateNoIndexHeaders,
  authenticateJWT,
  authorize(ROLES.ADMIN),
);

// Страница входа и ресурсы CRM остаются доступными, но рабочие HTML-экраны
// сервер отдаёт только после проверки JWT из httpOnly cookie/Bearer header.
app.get(
  ["/crm/crm/admin.html", "/crm/crm/works.html"],
  authenticateJWT,
  authorize(ROLES.ADMIN),
);
app.get(
  [
    "/crm/crm/archive.html",
    "/crm/crm/calculator.html",
    "/crm/crm/clients.html",
    "/crm/crm/dashboard.html",
    "/crm/crm/order.html",
    "/crm/crm/production.html",
  ],
  authenticateJWT,
);

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

// Canonical public URLs serve their source HTML without an internal redirect.
const PUBLIC_PAGE_ROUTES = {
  "/catalog": "/pages/catalog.html",
  "/services": "/pages/services.html",
  "/works": "/pages/works.html",
  "/about": "/pages/about.html",
  "/contacts": "/pages/contacts.html",
  "/calculator": "/pages/calculator.html",
  "/stoleshnicy": "/pages/stoleshnicy.html",
  "/stoleshnicy/dlya-kuhni": "/pages/stoleshnicy-dlya-kuhni.html",
  "/stoleshnicy/iz-kvarca": "/pages/stoleshnicy-iz-kvarca.html",
  "/stoleshnicy/dlya-vannoy": "/pages/stoleshnicy-dlya-vannoy.html",
  "/podokonniki": "/pages/podokonniki.html",
  "/materialy/kvarcevyj-aglomerat": "/pages/kvarcevyj-aglomerat.html",
  ...Object.fromEntries(
    Object.values(PROJECT_SLUGS).map((slug) => [
      `/works/${slug}`,
      `/pages/works/${slug}.html`,
    ]),
  ),
};

for (const [publicPath, sourcePath] of Object.entries(PUBLIC_PAGE_ROUTES)) {
  const canonicalPath = `${publicPath}/`;

  // Retain links to the old technical URLs with one permanent redirect.
  app.get(sourcePath, (req, res) => res.redirect(301, canonicalPath));

  // Express routes are non-strict by default, so normalize the slash inside
  // one handler instead of registering overlapping routes.
  app.get([publicPath, canonicalPath], (req, res, next) => {
    if (!req.path.endsWith("/")) return res.redirect(301, canonicalPath);

    // Express also handles HEAD through this GET route.
    res.sendFile(path.join(PUBLIC_DIR, sourcePath), (error) => {
      if (error) next(error);
    });
  });
}

app.use(express.static(PUBLIC_DIR, { index: "index.html" }));

// =========================================================
// FALLBACK-РОУТ (замена правилам .htaccess, которые Node
// игнорирует).
//
//   /api/*                       → JSON 404 (API не трогаем)
//   *.css, *.js, *.jpg, *.png,
//   *.csv и любой файл с «.»     → пропускаем → жёсткий 404
//   остальные GET/HEAD           → public/404.html со статусом 404
//
// В Express 5 нельзя использовать app.get("*") — wildcard-строки
// убраны, поэтому используем app.use().
// =========================================================
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

  // Unknown public URLs must be real 404s, not the home page with HTTP 200.
  return res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
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

  if (typeof err.code === "string" && err.code.startsWith("ER_")) {
    return res.status(500).json({
      success: false,
      message: "Калькулятор временно недоступен. Обновите страницу или свяжитесь с менеджером.",
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
process.on("unhandledRejection", (err) => {
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
    // Обязательные versioned migrations проверяются до legacy compatibility
    // DDL, чтобы обычный запуск не изменял немигрированную рабочую БД.
    const [versionColumns] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'version'",
    );
    const [idempotencyTables] = await pool.query(
      "SHOW TABLES LIKE 'order_idempotency_keys'",
    );
    if (versionColumns.length === 0 || idempotencyTables.length === 0) {
      throw new Error(
        "Required migrations are missing. Run ALLOW_SCHEMA_MIGRATIONS=1 npm run migrate before startup.",
      );
    }

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

    const [ptCols] = await pool.query(
      "SHOW COLUMNS FROM orders LIKE 'product_type'",
    );
    if (ptCols.length === 0) {
      await pool.query(
        "ALTER TABLE orders ADD COLUMN product_type VARCHAR(255) NULL COMMENT 'Тип изделия'",
      );
      console.log("✅ Добавлена колонка product_type в orders");
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
    throw error;
  }
}

// =========================================================
// ЗАПУСК СЕРВЕРА
// =========================================================
async function startServer(listenPort = port) {
  await ensureDatabaseSchema();
  return new Promise((resolve, reject) => {
    const server = app.listen(listenPort, () => {
      const address = server.address();
      const actualPort =
        address && typeof address === "object" ? address.port : listenPort;
      console.log(`🚀 Защищенный бэкенд запущен: http://localhost:${actualPort}`);
      console.log(`🔒 JWT-аутентификация активна`);
      console.log(`🔐 Ролевые ограничения справочников активны`);
      console.log(`✅ Zod-валидация активна для всех мутирующих эндпоинтов`);
      console.log(`✅ State Machine для статусов заказов активна`);
      console.log(`✅ Финансовые расчеты в целых числах (центы)`);
      console.log(`✅ Модульная архитектура (routes, controllers, middleware)`);
      console.log(
        `🌐 Разрешённые frontend-адреса: ${ALLOWED_ORIGINS.join(", ")}`,
      );
      console.log(`📁 Загрузка файлов: /uploads/orders/`);
      console.log(
        `📄 Статика: ${PUBLIC_DIR} (неизвестные публичные URL возвращают 404)`,
      );
      resolve(server);
    });
    server.once("error", reject);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Сервер не запущен: схема БД не готова", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, ensureDatabaseSchema, startServer };
