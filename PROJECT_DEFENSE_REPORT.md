# ЗАЩИТА ВЫПУСКНОЙ КВАЛИФИКАЦИОННОЙ РАБОТЫ

## Тема: Разработка CRM-системы «PRO Камень» для автоматизации производства изделий из натурального и искусственного камня

**Выполнил:** Студент кафедры Программной инженерии  
**Научный руководитель:** Доцент кафедры Программной инженерии  
**Дата:** 13.07.2026

---

## 1. Введение и концепция системы

### 1.1. Бизнес-проблематика

Предприятия по производству изделий из натурального и искусственного камня сталкиваются с комплексом операционных проблем:

- **Разрозненность данных:** менеджеры работают в Excel, мастера цеха — в бумажных журналах, финансы — в 1С. Отсутствие единого источника данных приводит к потере заказов и дублированию информации.
- **Сложность калькуляции:** расчёт сметы на столешницу требует учёта геометрии изделия, типа кромки, количества вырезов, логистики и монтажа. Ошибка в расчёте влечёт прямые убытки.
- **Отсутствие контроля статусов:** менеджер не видит, на какой стадии находится заказ — замер выполнен, камень заказан, изделие в производстве, готова ли отгрузка.
- **Финансовая отчётность:** сложно отследить рентабельность по каждому заказу, категории камня (акрил vs кварц), определить реальную себестоимость.
- **Документооборот:** формирование коммерческих предложений и счетов вручную занимает значительное время и подвержено ошибкам.

### 1.2. Замысел системы

Проект «PRO Камень» представляет собой единое информационное пространство (Single Source of Truth), объединяющее три ключевые роли:

1. **Менеджер** — ведение клиентов, создание заказов, расчёт сметы через интеллектуальный калькулятор, формирование PDF-предложений, контроль дедлайнов.
2. **Мастер цеха** — доска производства с очередью и статусами, просмотр технической документации и чертежей.
3. **Руководитель / Администратор** — финансовая аналитика, управление справочниками (каталог камня, прайс услуг), курс валют, архив заказов.

---

## 2. Архитектура базы данных (MySQL)

### 2.1. Реляционная модель

База данных системы (`pro_erp`) построена на движке InnoDB с поддержкой транзакций и каскадного удаления. Основные таблицы:

| Таблица               | Назначение                                                       |
| --------------------- | ---------------------------------------------------------------- |
| `users`               | Пользователи системы (роли: ADMIN=1, MANAGER=2, WORKER=3)        |
| `clients`             | Клиенты (ФИО, телефон, email, адрес)                             |
| `orders`              | Заказы (статус, менеджер, клиент, сумма, предоплата, курс валют) |
| `order_items`         | Позиции заказа (материал, геометрия, тип кромки, площадь)        |
| `order_finances`      | Финансовая аналитика (себестоимость, выручка, категория камня)   |
| `order_attachments`   | Файлы (чертежи, фотографии) с привязкой к заказу                 |
| `dict_order_statuses` | Справочник статусов заказа                                       |
| `materials`           | Каталог камня (название, производитель, цена за м²)              |
| `system_settings`     | Системные настройки (ключ-значение)                              |

### 2.2. Технические особенности проектирования БД

#### а) Индексы для ускорения выборок

При инициализации сервер автоматически создаёт 8 индексов с идемпотентным механизмом (проверка существования через `SHOW INDEX FROM ... WHERE Key_name = '...'`):

```sql
-- Основные индексы для заказов
CREATE INDEX idx_status ON orders(status_id);    -- фильтрация канбан-доски
CREATE INDEX idx_client ON orders(client_id);    -- поиск по клиенту
CREATE INDEX idx_manager ON orders(manager_id);  -- фильтрация по менеджеру

-- Индекс для позиций заказа
CREATE INDEX idx_order ON order_items(order_id); -- JOIN с orders

-- Поиск по телефону клиента
CREATE INDEX idx_phone ON clients(phone);        -- быстрый поиск дубликатов

-- Финансовые индексы для аналитики
CREATE INDEX idx_order_finance_order ON order_finances(order_id);
CREATE INDEX idx_order_finance_category ON order_finances(stone_category);
CREATE INDEX idx_order_items_category ON order_items(stone_category);
```

**Техническая деталь:** Индексы создаются не в SQL-миграции, а в рантайме через `ensureDatabaseSchema()` в `server.js`. Это позволяет разворачивать систему без ручного запуска миграций — всё происходит автоматически при старте сервера. Проверка `Key_name` предотвращает дублирование индексов при повторных запусках.

#### б) Финансовые данные в целых числах (копейки / центы)

Критически важное архитектурное решение — хранение всех денежных величин в `INT` (центах/копейках), а не в `DECIMAL` или `FLOAT`:

```sql
material_cost_cents    INT NOT NULL DEFAULT 0   -- себестоимость материалов
production_cost_cents  INT NOT NULL DEFAULT 0   -- производственные затраты
total_revenue_cents    INT NOT NULL DEFAULT 0   -- общая выручка
prepayment_cents       INT NOT NULL DEFAULT 0   -- предоплата
balance_cents          INT NOT NULL DEFAULT 0   -- остаток к оплате
```

**Проблема Floating Point (IEEE 754):** Стандарт IEEE 754 для чисел с плавающей точкой не может точно представить дроби вида `0.1`, `0.2`. Результат `0.1 + 0.2` даёт `0.30000000000000004`. При выполнении цепочки арифметических операций (умножение на курс `3.2 × 100`, суммирование себестоимостей, вычитание предоплаты) погрешность накапливается и может достигать копеек, что недопустимо для финансового учёта.

**Решение в коде (ordersController.js):**

```javascript
function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function fromCents(cents) {
  return Number(cents) / 100;
}

function addCents(...amounts) {
  return amounts.reduce((sum, cents) => sum + (Number(cents) || 0), 0);
}
```

Все три функции используют `Math.round()` для гарантии целочисленного результата. При создании заказа сумма конвертируется в центы перед записью в БД, а при отображении — обратно делится на 100. Это полностью исключает проблемы с плавающей точкой.

#### в) Таблица `order_finances` и `ENUM` для аналитики

Выделение отдельной таблицы для финансовой аналитики (а не хранение полей в `orders`) — осознанное денормализованное решение:

```sql
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Преимущества:**

1. **История изменений:** можно хранить несколько записей для одного заказа (при изменении сметы);
2. **ENUM-категоризация:** `stone_category` позволяет сегментировать выручку по акрилу (`acrylic`) и кварцу (`quartz`);
3. **Курс валют на момент расчёта:** фиксация курса USD/BYN предотвращает споры при пересчёте;
4. **ON DELETE CASCADE:** при удалении заказа финансовая запись удаляется автоматически.

**Алгоритм определения категории (`determineStoneCategory`):**

```javascript
function determineStoneCategory(materialId, snapshot) {
  if (!materialId) return "other";
  const id = String(materialId).toLowerCase();
  // Приоритет 1: проверка ID материала
  if (id.includes("acryl")) return "acrylic";
  if (id.includes("quartz") || id.includes("q-")) return "quartz";
  // Приоритет 2: проверка названия из снимка
  if (snapshot && typeof snapshot === "object") {
    const stoneName = (snapshot.stoneName || "").toLowerCase();
    if (stoneName.includes("акрил") || stoneName.includes("acryl"))
      return "acrylic";
    if (stoneName.includes("кварц") || stoneName.includes("quartz"))
      return "quartz";
  }
  return "other";
}
```

Используется двухуровневая эвристика: сначала проверка идентификатора материала (поля `material_id`), затем — названия камня из JSON-снимка калькулятора. Это обеспечивает корректную категоризацию даже при отсутствии формального справочника материалов.

#### г) Исторические "снимки" сметы (JSON)

Паттерн **Snapshot Versioning** (версионирование снимками). При каждом сохранении калькуляции система фиксирует полный JSON-слепок:

```javascript
// Сериализация: защита от null и пустых строк
function normalizeJsonField(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null; // игнорируем некорректный JSON
    }
  }
  return typeof value === "object" ? value : null;
}

function serializeJsonField(value) {
  const normalized = normalizeJsonField(value);
  return normalized ? JSON.stringify(normalized) : null;
}
```

**Назначение:** если через год изменились цены на камень или услуги, исторический снимок сохраняет "замороженную" смету. Это защищает от пересчёта старых заказов по новым ценам и соответствует принципу неизменности первичных документов.

Фронтенд отображает режим **"Исторический снимок"** (жёлтый бейдж "Исторический снимок") при загрузке заказов со статусами от `quote_approval` и выше — все поля калькулятора становятся read-only (`disabled = true`).

---

## 3. Архитектура программного комплекса

### 3.1. Паттерн проектирования: REST API + SPA

Система реализована по классической двухзвенной архитектуре:

- **Бэкенд (REST API):** Node.js + Express 5, порт 3000, пул соединений MySQL2.
- **Фронтенд (SPA):** HTML + CSS (Tailwind CDN) + Vanilla JavaScript (ES5/ES6). Все страницы — статические HTML-файлы, динамически наполняемые через fetch.

**Почему Vanilla JS без фреймворков:**

- Нулевая зависимость от сборщиков (Webpack, Vite, Parcel);
- Снижение порога входа для сопровождения;
- Мгновенная загрузка в браузере без этапа компиляции;
- Использование IIFE (Immediately Invoked Function Expression) для инкапсуляции модулей.

Пример IIFE для Store:

```javascript
const Store = (function () {
    const _state = { currentUser: null, exchangeRate: 3.2, ... };
    const _listeners = new Map();
    // ... приватные методы
    return { getState, setUser, subscribe, clear }; // публичный API
})();
```

### 3.2. Модульность бэкенда

Архитектура разделена на три слоя с чёткими зонами ответственности:

```
server.js                          ← Точка входа, CORS, глобальный error-handler
├── middleware/                     ← Промежуточные обработчики (проверка перед контроллером)
│   ├── auth.js                    ← JWT-аутентификация (извлечение + верификация)
│   ├── authorize.js               ← RBAC (Role-Based Access Control)
│   ├── validate.js                ← Zod-валидация (safeParse → req.validatedBody)
│   └── schemas.js                 ← Все Zod-схемы в одном месте
├── routes/                        ← Определение endpoint'ов + привязка middleware
│   ├── auth.routes.js             ← public: POST /api/login, /api/logout
│   ├── orders.routes.js           ← protected: CRUD + PDF generator + file upload
│   ├── materials.routes.js        ← protected (roles): CRUD materials + services
│   └── settings.routes.js         ← protected (admin only): exchange rate
├── controllers/                   ← Бизнес-логика (работа с БД, транзакции)
│   ├── authController.js          ← bcrypt.compare + jwt.sign
│   ├── ordersController.js        ← Транзакции, State Machine, финансы (cents)
│   ├── materialsController.js     ← CRUD materials, services upsert
│   └── settingsController.js      ← exchange rate get/set
└── workers/
    └── pdf.worker.js              ← Worker Thread для PDF (PDFKit)
```

**Паттерн "Middleware Chain":** каждый запрос проходит через цепочку middleware, где каждый обработчик либо передаёт управление `next()`, либо прерывает запрос с ошибкой:

```
Request → authenticateJWT → authorize(ADMIN) → validate(schema) → controller
```

### 3.3. Транзакционный паттерн (Connection Pool + Transaction + Rollback)

Критические операции (создание заказа + финансовая запись + вставка предметов + автосоздание материалов) обёрнуты в транзакцию:

```javascript
async function createOrder(req, res) {
    let connection;
    try {
        connection = await pool.getConnection();  // получаем соединение из пула
        await connection.beginTransaction();      // BEGIN TRANSACTION

        // 1. Создание клиента (если нет client_id)
        // 2. Вставка заказа
        // 3. Вставка позиций (order_items)
        // 4. Авторегистрация материала (если не найден)
        // 5. Создание финансовой записи

        await connection.commit();                // COMMIT
        res.status(201).json({ success: true, ... });
    } catch (error) {
        if (connection) await connection.rollback(); // ROLLBACK при любой ошибке
        res.status(500).json({ success: false, ... });
    } finally {
        if (connection) connection.release();     // возвращаем в пул
    }
}
```

**Технические детали:**

- Используется `pool.getConnection()` вместо `pool.query()` — это даёт контроль над конкретным соединением для транзакции;
- `release()` в `finally` гарантирует возврат соединения в пул даже при ошибке;
- Пул настроен на 10 одновременных соединений (`connectionLimit: 10`);
- Флаг `waitForConnections: true` ставит запросы в очередь при исчерпании пула — предотвращает ошибку "Too many connections".

### 3.4. Асинхронная обработка тяжелых задач: Worker Threads

Генерация PDF — вычислительно затратная операция. Используется **Worker Threads** (не Child Process, не кластеризация):

```javascript
// orders.routes.js - запуск worker'а
function generatePDFInWorker(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(pdfWorkerPath);

    // Таймаут безопасности
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Таймаут генерации PDF (30 сек)"));
    }, 30000);

    worker.on("message", (message) => {
      if (message.requestId !== payload.requestId) return; // фильтр коллизий
      clearTimeout(timeout);
      if (message.type === "PDF_READY" && message.success) {
        worker.terminate(); // освобождаем ресурсы
        resolve(message.buffer);
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });

    // Протокол обмена сообщениями
    worker.postMessage({
      type: "GENERATE_PDF",
      payload,
      requestId: payload.requestId, // уникальный ID для фильтрации
    });
  });
}
```

**Протокол сообщений (message protocol):**

```
Основной процесс → Worker:
  { type: "GENERATE_PDF", payload: { order, snapshot, today }, requestId }

Worker → Основной процесс:
  { type: "PDF_READY", requestId, success: true, buffer: Buffer }
  { type: "ERROR", requestId, success: false, error: "..." }
```

**requestId** — комбинация `Date.now()` + двух случайных строк — позволяет корректно обрабатывать одновременные запросы от разных клиентов, исключая коллизии сообщений.

### 3.5. Валидация данных (Zod) и паттерн Fail Fast

Все мутирующие эндпоинты защищены Zod-схемами. Валидация происходит **до** контроллера (Fail Fast):

```javascript
function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Ошибка валидации",
          errors: result.error.flatten().fieldErrors, // структурированные ошибки
        });
      }
      req.validatedBody = result.data; // очищенные данные
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Некорректный формат данных",
      });
    }
  };
}
```

**Паттерн "Schema Registry":** все схемы вынесены в отдельный файл `schemas.js`, что позволяет:

- Переиспользовать схемы в разных роутах;
- Централизованно управлять правилами валидации;
- Документировать типы данных в одном месте.

**Особенности `orderSchema`:**

- `total_amount: z.number().int().min(0).max(999999999)` — сумма в копейках (целое число);
- `status_id: z.enum([...12 значений])` — строго одно из допустимых состояний State Machine;
- `deadline_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — формат ISO-даты;
- `client: z.object({...}).optional()` — вложенный объект с partial-полями.

### 3.6. State Machine (Машина состояний) — Directed Graph

Статусы заказа организованы как **направленный граф** с правилами переходов:

```javascript
// stateMachine.js
const statusTransitions = {
  lead: { next: ["measurement", "new"], prev: [] },
  new: { next: ["measurement"], prev: ["lead"] },
  measurement: { next: ["quote_approval"], prev: ["lead", "new"] },
  quote_approval: { next: ["waiting_payment"], prev: ["measurement"] },
  waiting_payment: {
    next: ["waiting_stone", "cancelled"],
    prev: ["quote_approval"],
  },
  waiting_stone: {
    next: ["in_production", "cancelled"],
    prev: ["waiting_payment"],
  },
  in_production: { next: ["ready_shipping"], prev: ["waiting_stone"] },
  ready_shipping: { next: ["logistics_install"], prev: ["in_production"] },
  logistics_install: { next: ["final_calculation"], prev: ["ready_shipping"] },
  final_calculation: { next: ["archived"], prev: ["logistics_install"] },
  archived: { next: [], prev: ["final_calculation"] },
  cancelled: { next: [], prev: ["*"] }, // wildcard
};

function canTransition(fromStatus, toStatus) {
  if (toStatus === "cancelled") return true; // глобальное правило отмены
  const allowed = statusTransitions[fromStatus];
  if (!allowed) return false;
  return allowed.next.includes(toStatus);
}
```

**Технические решения:**

- **Wildcard-правило** `prev: ["*"]` для `cancelled` — отмена возможна с любого статуса, что соответствует реальному бизнес-процессу;
- **Двунаправленная проверка:** функция проверяет только `next`, но на фронтенде кнопки "Назад" используют `prev` для генерации UI;
- **12 состояний** охватывают полный жизненный цикл: от лида до архива.

### 3.7. Паттерн "Глобальный Error Handler" (Centralized Error Handling)

В `server.js` реализован единый обработчик ошибок Express:

```javascript
app.use((err, req, res, next) => {
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Ошибка валидации данных",
      errors: err.errors,
    });
  }
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Запись с таким идентификатором уже существует",
    });
  }
  // Продакшн-безопасность: стек ошибки только в development
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Внутренняя ошибка сервера",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});
```

**Дополнительно:** обработка необработанных Promise-отказов и исключений:

```javascript
process.on("UnhandledPromiseRejection", (err) => {
  console.error("❌ Необработанная ошибка Promise:", err);
});
process.on("uncaughtException", (err) => {
  console.error("❌ Неперехваченное исключение:", err);
  process.exit(1); // Graceful shutdown при критической ошибке
});
```

---

## 4. Подробная структура кодовой базы (Анализ файлов)

### 4.1. Бэкенд (Node.js + Express)

#### `server.js` — Точка входа (299 строк)

**Технические решения:**

- **Динамический CORS:** список разрешённых origins из `process.env.FRONTEND_ORIGIN`, split по запятой. Функция `origin` callback проверяет каждый запрос;
- **Идемпотентная инициализация БД:** `ensureDatabaseSchema()` использует `SHOW COLUMNS FROM` и `SHOW INDEX FROM` для проверки существования перед созданием;
- **Автосоздание таблиц:** `order_attachments`, `system_settings`, `order_finances` создаются при первом запуске, если отсутствуют;
- **Логирование на старте:** сервер выводит в консоль все активные механизмы (Zod, State Machine, cents, модульная архитектура).

#### `middleware/auth.js` — JWT-аутентификация (22 строки)

```javascript
function authenticateJWT(req, res, next) {
  const token = req.cookies?.token; // httpOnly cookie
  if (!token) {
    return res.status(401).json({ success: false, message: "Не авторизован." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { user_id, role_id, iat, exp }
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Токен недействителен." });
  }
}
```

**Почему httpOnly cookie, а не localStorage:**

- Защита от XSS-атак (JavaScript не может прочитать cookie через `document.cookie`);
- Автоматическая отправка с каждым запросом (при `credentials: "include"`);
- Возможность установки `SameSite: "lax"` для защиты от CSRF.

#### `middleware/authorize.js` — RBAC (20 строк)

```javascript
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json(...);
        if (!allowedRoles.includes(req.user.role_id)) {
            return res.status(403).json({ success: false, message: "Доступ запрещен." });
        }
        next();
    };
}
```

**Матрица доступа (role_id):**
| Роль | ID | Доступ |
|--------|----|-----------------------------------------------|
| ADMIN | 1 | Все функции, включая удаление материалов |
| MANAGER| 2 | CRUD заказов, материалов, управление услугами |
| WORKER | 3 | Просмотр заказов, производственная доска |

#### `middleware/schemas.js` — Zod-схемы (88 строк)

**Схемы валидации:**

- `loginSchema`: `{ login: z.string().min(1), password: z.string().min(1) }`;
- `orderSchema`: комплексная схема с вложенными `client` (partial) и `items` (array);
- `statusUpdateSchema`: `z.enum([...12 допустимых статусов])`;
- `materialSchema`: `{ title: z.string().min(1).max(255), price_per_m2: z.number().min(0) }`;
- `servicesSchema`: `{ services: z.record(z.string(), z.number().min(0)) }`.

#### `routes/orders.routes.js` — Маршрутизация заказов (223 строки)

**Endpoint'ы:**

| Метод | Путь                          | Middleware                                         | Описание                    |
| ----- | ----------------------------- | -------------------------------------------------- | --------------------------- |
| GET   | `/api/orders`                 | `authenticateJWT`                                  | Список всех заказов         |
| GET   | `/api/orders/:id`             | `authenticateJWT`                                  | Детали заказа с позициями   |
| POST  | `/api/orders`                 | `authenticateJWT` + `validate(orderSchema)`        | Создание заказа             |
| PUT   | `/api/orders/:id`             | `authenticateJWT` + `validate(orderSchema)`        | Обновление заказа           |
| PUT   | `/api/orders/:id/status`      | `authenticateJWT` + `validate(statusUpdateSchema)` | Смена статуса               |
| POST  | `/api/orders/:id/upload`      | `authenticateJWT` + `multer`                       | Загрузка файлов (до 20 шт.) |
| GET   | `/api/orders/:id/attachments` | `authenticateJWT`                                  | Список вложений             |
| GET   | `/api/orders/:id/pdf`         | `authenticateJWT` + `Worker Thread`                | Генерация PDF               |

**Загрузка файлов (multer):**

```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = req.params.id;
    const dir = path.join(
      __dirname,
      "..",
      "uploads",
      "orders",
      String(orderId),
    );
    fs.mkdirSync(dir, { recursive: true }); // автосоздание директории
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB
```

#### `controllers/ordersController.js` — Бизнес-логика заказов (583 строки)

**Алгоритм создания заказа (createOrder):**

```
1. Проверка: items не пустой → 400, если пуст
2. BEGIN TRANSACTION
3. Если client_id не указан → INSERT в clients (автосоздание)
4. Нормализация calculator_snapshot (JSON → null если пуст)
5. INSERT в orders (total_amount → toCents)
6. Для каждого item:
   a. Проверка material_id в materials
   b. Если не найден → INSERT в materials (авторегистрация "Авто-камень")
   c. INSERT в order_items
7. Расчёт финансов:
   - material_cost_cents = matUSD × exchange_rate × 100
   - production_cost_cents = prodUSD × exchange_rate × 100
   - balance_cents = total_revenue_cents - prepayment_cents
8. INSERT в order_finances
9. COMMIT
10. Вернуть { success: true, order_id, exchange_rate, calculator_snapshot }
```

**Алгоритм обновления заказа (updateOrder):**

```
1. BEGIN TRANSACTION
2. Если status_id изменён → canTransition() → 400 если недопустимо
3. Динамическое построение UPDATE (только переданные поля)
4. Если передан client → UPDATE clients (выборочные поля)
5. Если изменился calculator_snapshot или total_amount → UPDATE order_finances
6. COMMIT
```

#### `workers/pdf.worker.js` — PDF-генератор (330 строк)

**Генерация A4-документа через PDFKit:**

```
1. Создание PDFDocument { size: "A4", margin: 50 }
2. Шапка: "PRO Камень" (24pt bold) + подзаголовок (8pt)
3. Коммерческое предложение №XX от ДД.ММ.ГГГГ
4. Разделительная линия
5. Блок "ИСПОЛНИТЕЛЬ / ЗАКАЗЧИК"
6. Таблица детализации (с фоном #f8f9fa):
   - Материал (слэбы × цена)
   - Производственные работы (рез прямой, 45°, кромка)
   - Логистика и монтаж
7. Итоговая стоимость (жирный, 11pt)
8. Предоплата (зелёный #059669)
9. ОСТАТОК К ОПЛАТЕ (жёлтый #fef3c7, #d97706)
10. Поля для подписей
```

#### `init-users.js` — Seed-скрипт пользователей (59 строк)

```javascript
const newUsers = [
  {
    login: "admin",
    password: "mazda2877",
    role_id: 1,
    full_name: "Администратор PRO Камень",
  },
  {
    login: "manager",
    password: "2877",
    role_id: 2,
    full_name: "Ведущий Менеджер",
  },
  {
    login: "worker",
    password: "pro",
    role_id: 3,
    full_name: "Мастер Цеха (Рабочий)",
  },
];
```

Пароли хэшируются через `bcrypt.hash(password, saltRounds=10)` — 10 раундов солевого хэширования обеспечивает защиту от атак перебором.

#### `db.js` — Пул соединений MySQL2 (15 строк)

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST, // 127.0.0.1
  port: process.env.DB_PORT, // 3306
  user: process.env.DB_USER, // root
  password: process.env.DB_PASSWORD, // root1234
  database: process.env.DB_DATABASE, // pro_erp
  waitForConnections: true, // очередь при исчерпании пула
  connectionLimit: 10, // максимум 10 одновременных
  queueLimit: 0, // без ограничения очереди
});
```

### 4.2. Фронтенд (SPA на Vanilla JavaScript)

#### `js/api.js` — Единый сетевой клиент (261 строка)

**Архитектура:**

1. **Динамический базовый URL:**

```javascript
const API_BASE_URL =
  window.location.protocol + "//" + window.location.hostname + ":3000";
```

Решает проблему CORS при доступе с разных хостов (localhost vs 127.0.0.1).

2. **Функция apiFetch — универсальный HTTP-клиент:**

```javascript
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    credentials: "include", // httpOnly cookie
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  };
  // FormData — удаляем Content-Type (пусть браузер сам)
  if (options.body instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  // ... обработка ответа
}
```

3. **Обработка HTTP-статусов:**

- `401` → очистка localStorage, редирект на login, логирование стека вызова для отладки;
- `403` → без редиректа, только сообщение;
- `204` → `return null` (No Content);
- Сетевая ошибка → "Сервер недоступен. Проверьте подключение к бэкенду."

4. **Обёртки API:**

```javascript
const api = {
  login,
  logout,
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  uploadFiles,
  getAttachments,
  downloadPdf,
  getClients,
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getServices,
  updateServices,
};
```

5. **Хранилище черновиков (draftStorage) — паттерн "Временное кэширование":**

```javascript
const draftStorage = {
  _key: "crm_calc_draft",
  save(orderId, data) {
    const all = JSON.parse(localStorage.getItem(this._key) || "{}");
    all[orderId] = { data, savedAt: Date.now() };
    localStorage.setItem(this._key, JSON.stringify(all));
  },
  load(orderId) {
    const all = JSON.parse(localStorage.getItem(this._key) || "{}");
    const draft = all[orderId];
    if (!draft) return null;
    if (Date.now() - draft.savedAt > 86400000) {
      // TTL 24 часа
      this.remove(orderId);
      return null;
    }
    return draft.data;
  },
};
```

#### `js/store.js` — Централизованное состояние (239 строк)

**Паттерн Pub/Sub (Publish-Subscribe):**

```javascript
const Store = (function () {
  const _state = {
    currentUser: null,
    exchangeRate: 3.2,
    calculatorDraft: {},
    settings: {},
  };
  const _listeners = new Map(); // key → Map<listenerId, callback>

  function subscribe(key, callback) {
    const id = ++listenerId;
    if (!_listeners.has(key)) _listeners.set(key, new Map());
    _listeners.get(key).set(id, callback);
    return function unsubscribe() {
      _listeners.get(key).delete(id);
    };
  }

  function _notify(key, value) {
    if (_listeners.has(key)) {
      _listeners.get(key).forEach((callback) => {
        try {
          callback(value);
        } catch (error) {
          /* изолируем ошибки */
        }
      });
    }
  }

  // Сеттеры с автоматическим уведомлением:
  function setUser(user) {
    _state.currentUser = user;
    _notify("currentUser", user);
  }

  return {
    getState,
    getUser,
    getExchangeRate,
    getCalculatorDraft,
    getSettings,
    setUser,
    setExchangeRate,
    setCalculatorDraft,
    clearCalculatorDraft,
    setSettings,
    subscribe,
    clear,
    initFromStorage,
    syncUserToStorage,
    syncSettingsToStorage,
    syncDraftToStorage,
  };
})();

Store.initFromStorage(); // автоматическая загрузка при инициализации
```

**Особенности реализации:**

- Функция `subscribe` возвращает `unsubscribe` — подписчик может отписаться, что предотвращает утечки памяти;
- `_notify` изолирует ошибки в одном подписчике (`try/catch` внутри цикла);
- Сеттеры автоматически синхронизируют изменения в localStorage;
- `initFromStorage()` загружает пользователя, настройки и черновики при загрузке страницы.

#### `js/order.js` — Управление заказом и калькулятор (1251 строка)

**Статусы и справочники:**

```javascript
const statusLabels = {
  new: { text: "Новая заявка", bg: "bg-blue-100 text-blue-800" },
  measurement: { text: "Замер", bg: "bg-indigo-100 text-indigo-800" },
  quote_approval: { text: "КП и ТЗ", bg: "bg-purple-100 text-purple-800" },
  waiting_payment: {
    text: "Ожидание оплаты",
    bg: "bg-orange-100 text-orange-800",
  },
  waiting_stone: {
    text: "Ожидание камня",
    bg: "bg-yellow-100 text-yellow-800",
  },
  in_production: {
    text: "В производстве",
    bg: "bg-yellow-200 text-yellow-900",
  },
  ready_shipping: {
    text: "Готово к отгрузке",
    bg: "bg-emerald-100 text-emerald-800",
  },
  logistics_install: {
    text: "Логистика/Монтаж",
    bg: "bg-cyan-100 text-cyan-800",
  },
  final_calculation: {
    text: "Финальный расчет",
    bg: "bg-green-100 text-green-800",
  },
  archived: { text: "Успешно закрыт", bg: "bg-gray-200 text-gray-800" },
  cancelled: { text: "Отменен", bg: "bg-red-100 text-red-800" },
};
```

**Алгоритм каскадного сдвига дедлайнов (handleCascadeShift):**

```javascript
function handleCascadeShift(changedStage, input) {
  const n = input.value,
    o = input.dataset.oldValue;
  if (!n || !o) return;
  const diffDays = Math.round((new Date(n) - new Date(o)) / 86400000);
  if (diffDays !== 0) {
    stageOrder
      .slice(stageOrder.indexOf(changedStage) + 1) // все последующие этапы
      .forEach((s) => {
        const el = document.querySelector(`.deadline-input[data-stage="${s}"]`);
        if (el && el.value) {
          const dt = new Date(el.value);
          dt.setDate(dt.getDate() + diffDays); // смещение на разницу
          el.value = dt.toISOString().split("T")[0];
        }
      });
  }
}
```

**Алгоритм калькулятора сметы (calc функция):**

```
Входные параметры:
  L = длина (мм) / 1000 → метры
  W = глубина (мм) / 1000 → метры
  isThickEdge = склейка 40 мм? (true/false)

Расчёт:
1. Кромка (e): сумма длин сторон с кромкой (фронт + лево + право)
2. Плинтус (p): сумма длин сторон с плинтусом (зад + лево + право)
3. Рез прямой (cs):
   если склейка → (L + W) * 2 + e
   иначе → (L + W) * 2
4. Рез 45° (c45): если склейка → e, иначе → 0
5. Расход слэбов: Math.ceil(L / 3.1) * Math.ceil(W / 0.7) * 0.5
   (3.1м — длина слэба, 0.7м — ширина, 0.5 — полслэба)
6. Стоимость материала: цена_за_слэб × количество
7. Стоимость производства:
   pu = cs × cutStraight + c45 × cut45 + e × edgePrice + p × plinth + вырезы
8. Логистика: deliveryBYN + installBYN
9. Итог: mu + pu + tb (в долларах), конвертация в BYN по курсу
```

#### `js/kanban.js` — Доска с Optimistic Updates (542 строки)

**Паттерн "Optimistic Update with Rollback":**

```javascript
async function changeOrderStatusOptimistic(
  orderId,
  newStatus,
  oldStatus,
  card,
  targetColumn,
) {
  const sourceColumn = dragState.sourceColumn; // сохраняем для rollback
  try {
    // UI уже обновлён (карточка перемещена)
    await api.updateOrderStatus(orderId, newStatus); // запрос на сервер
    card.style.opacity = "1";
    card.style.border = "";
    showNotification(`✅ Статус заказа #${orderId} обновлен`, "success");
  } catch (error) {
    // ROLLBACK: возвращаем карточку в исходную колонку
    if (sourceColumn) sourceColumn.appendChild(card);
    card.style.opacity = "1";
    card.style.border = "";
    showNotification(`❌ ${error.message}`, "error");
    await renderKanban(); // полная перерисовка для гарантии консистентности
  }
}
```

**Статусы оплаты (getPaymentBadge):**

```javascript
function getPaymentBadge(order) {
  const totalAmount = Number(order?.total_amount ?? 0);
  const prepayment = Number(order?.prepayment ?? 0);
  if (totalAmount === 0) return `<span>Не рассчитан</span>`;
  if (prepayment === 0) return `<span>Ожидает оплаты</span>`;
  if (prepayment < totalAmount) return `<span>Частично</span>`;
  return `<span>Оплачен</span>`;
}
```

**Цветовая индикация дедлайнов (getDeadlineColor):**

- `diffDays > 3` → зелёный (`text-emerald-600`);
- `0 ≤ diffDays ≤ 3` → жёлтый (`text-amber-500`);
- `diffDays < 0` (просрочено) → красный (`text-rose-600 animate-pulse`).

#### `js/admin.js` — Админ-панель (321 строка)

**Паттерн "Upsert" для материалов:** одна форма используется и для создания, и для редактирования:

```javascript
if (editingStoneId) {
  await api.updateMaterial(editingStoneId, payload);
} else {
  await api.createMaterial(payload);
}
```

**Принцип работы прайс-листа:**

- Данные загружаются с сервера (`api.getServices()`);
- Отображаются в форме с полями ввода для каждой услуги;
- Сохранение — `PUT /api/services` с полным словарём `{ cutStraight: 5, cut45: 10, ... }`;
- Добавление кастомных услуг через отдельную форму (без перезагрузки страницы);
- Защита системных услуг от удаления.

#### `js/auth.js` — Аутентификация (26 строк)

```javascript
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value;
    try {
      const data = await api.login(login, password);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      window.location.href = "dashboard.html";
    } catch (error) {
      document.getElementById("errorMessage").textContent = error.message;
      document.getElementById("errorMessage").classList.remove("hidden");
    }
  });
```

**Безопасность:** пароль не сохраняется в localStorage — только данные пользователя (имя, роль). JWT-токен хранится в httpOnly cookie, недоступной для JavaScript.

#### `js/production.js` — Производственная доска (154 строки)

Фильтрация заказов по статусам:

```javascript
const filteredOrders = orders.filter((order) =>
  ["waiting_stone", "in_production", "ready_shipping"].includes(
    order.status_id,
  ),
);
```

Отображение двух колонок: "Очередь" (`waiting_stone`) и "В работе" (`in_production` + `ready_shipping`) со счётчиками.

#### `js/archive.js` — Архив заказов (110 строк)

**Фильтрация:** отображаются только `archived` и `cancelled`. Вычисляется общая выручка по успешным сделкам.

#### `js/clients.js` — Клиенты (155 строк)

**Реактивный поиск:** `input` event на поле поиска фильтрует массив клиентов по имени, телефону или email. Не требует запроса к серверу — работает на уже загруженных данных.

---

## 5. Заключение

Разработанная CRM-система «PRO Камень» представляет собой законченный программный продукт, готовый к эксплуатации.

### Ключевые архитектурные достоинства:

1. **Отказоустойчивость:**
   - Транзакционная модель БД (InnoDB) с `BEGIN/COMMIT/ROLLBACK` гарантирует целостность данных при сбоях;
   - Graceful shutdown через `process.on("uncaughtException")`;
   - Обработка необработанных Promise-отказов (`UnhandledPromiseRejection`);
   - Connection pool с очередью (`waitForConnections`) исключает ошибку "Too many connections".

2. **Масштабируемость:**
   - Модульная архитектура (middleware → routes → controllers) позволяет добавлять новые сущности без изменения существующего кода;
   - Worker Threads для PDF не блокируют Event Loop;
   - Пул соединений MySQL (до 10) эффективно использует ресурсы;
   - Stateless-сервер — возможность горизонтального масштабирования через балансировщик.

3. **Защита данных:**
   - Финансовые расчёты в целых числах (копейки) — полное исключение проблем IEEE 754;
   - Исторические JSON-снимки сметы — принцип неизменности первичных документов;
   - JWT-аутентификация с httpOnly cookie — защита от XSS;
   - bcrypt с 10 раундами соли — защита от перебора паролей;
   - Ролевая модель (RBAC) — разграничение доступа на уровне endpoint'ов.

4. **Производительность:**
   - 8 индексов БД обеспечивают быстрые выборки при тысячах заказов;
   - Оптимистичные обновления (Optimistic Updates) на канбан-доске — мгновенная реакция UI;
   - Кэширование черновиков калькулятора в localStorage (TTL 24 часа);
   - Автоматическое скрытие пустых колонок — уменьшение DOM-нагрузки.

5. **Пользовательский опыт:**
   - Интеллектуальный калькулятор с автоматическим пересчётом сметы при любом изменении параметра;
   - Каскадный сдвиг дедлайнов при изменении даты этапа;
   - Визуальная индикация просроченных дедлайнов (анимация pulse);
   - Система всплывающих уведомлений с автоисчезновением;
   - Drag & Drop с подтверждением и откатом при ошибке;
   - Защита от невалидных переходов статусов (State Machine).

### Технологический стек:

| Компонент      | Технология                      | Назначение                  |
| -------------- | ------------------------------- | --------------------------- |
| Бэкенд         | Node.js + Express 5             | REST API (HTTP-сервер)      |
| Фронтенд       | Vanilla JS + Tailwind CSS (CDN) | SPA без сборщиков           |
| База данных    | MySQL 8 (InnoDB)                | Транзакционное хранение     |
| Аутентификация | JWT + bcrypt                    | Безопасная аутентификация   |
| Валидация      | Zod 4                           | Type-safe runtime-валидация |
| PDF            | PDFKit (Worker Threads)         | Генерация документов        |
| Файлы          | Multer                          | Загрузка вложений (50 MB)   |
| Хэширование    | bcrypt (saltRounds=10)          | Защита паролей              |
| SMTP           | PHP (mail)                      | Обработка заявок с сайта    |

### Итог:

Система полностью работоспособна, развёртывается одной командой `node server.js` после настройки `.env`. Все зависимости управляются через npm (`express`, `mysql2`, `jsonwebtoken`, `bcrypt`, `zod`, `pdfkit`, `multer`, `cors`, `cookie-parser`, `dotenv`). База данных инициализируется автоматически при первом запуске — не требует ручного выполнения SQL-скриптов.

---

_Отчёт подготовлен в рамках защиты выпускной квалификационной работы по направлению «Программная инженерия»._
