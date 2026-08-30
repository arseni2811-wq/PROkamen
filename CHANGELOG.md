# Changelog

Здесь фиксируются только изменения, существенные для дальнейшей разработки и подготовки диплома. Даты прошлых этапов взяты из Git-истории.

## Unreleased

### Добавлено

- Серверная JWT-защита HTML-экранов CRM, административных страниц и внутреннего прайса с ролевым ограничением для администраторов.
- Клиентская страница-визитка получила уникальные SEO/Open Graph-метаданные, статические контакты и ссылки на основные разделы сайта.
- Индивидуальное удаление вложений с ownership authorization, отдельным UI-крестиком, подтверждением «Удалить/Отмена», audit history и безопасным quarantine-потоком для согласования файла с metadata.
- Централизованная объектная авторизация заказов и безопасная production-проекция для worker.
- Optimistic locking через `orders.version` для заказа, калькулятора и статуса.
- Транзакционная поддержка `Idempotency-Key` для создания заказа.
- Миграции `003_orders_version.sql`, `004_order_idempotency.sql` и безопасное принятие baseline существующей БД.
- Regression/integration tests ownership, worker projection, calculator consistency, stale writes и последовательных/конкурентных idempotent retries.
- Постоянная документация проекта: `AGENTS.md`, `CONTEXT.md`, `TODO.md` и этот журнал.
- Baseline/incremental migration runner, empty-DB и сквозной integration tests.
- Regression/security tests для финансов, XSS, JWT-вложений, FormData/PDF, rate limit, services rollback и статусов.
- Structured request logs с request ID, integrity/anomaly scripts и backup/restore runbook.

### Изменено

- В рабочем дереве до начала документирования находилась незакоммиченная нормализация значений дедлайнов в карточке заказа: коррекция двухзначного года и приведение даты к `YYYY-MM-DD`.
- Seed пользователей переведён на обязательные env-пароли и безопасный opt-in upsert.
- PHP admin/contact configuration переведена на env; uploads исключены из Git index.

### Исправлено

- Служебные страницы CRM, админ-панелей и внутреннего прайса исключены из индексации через `meta robots` и `X-Robots-Tag`; визитка оставлена вне Sitemap.
- Точечный opt-in repair исправил однозначно обратимые mojibake metadata вложений 8, 9, 11 и 13 без изменения `file_path` и физических файлов.
- Исправлено mojibake Unicode-имён вложений: обратимое Latin-1 представление UTF-8 из Multer нормализуется один раз до записи metadata; добавлен авторизованный download endpoint с RFC 5987 `filename*`, физические имена файлов остаются сгенерированными.
- Исправлено объединение headers в CRM API helper: `Idempotency-Key` больше не перезаписывает `Content-Type: application/json`, из-за чего Express ранее получал `req.body === undefined`; FormData сохраняет автоматический multipart boundary.
- Форма нового заказа нормализует manager/rate/deadlines, ограничивает поля согласно Zod/DB и показывает точное поле validation error вместо общего сообщения; локальные сохранения явно обозначены как черновик.
- Повторный расчёт существующего заказа теперь атомарно синхронизирует `orders`, calculator snapshot, единственный `order_item`, `order_finances` и history.
- Manager больше не может читать/изменять чужой заказ, скачать его PDF/attachment или подменить `manager_id`; worker не получает клиентские и финансовые данные.
- Конкурентные записи больше не перезаписывают молча более новое состояние заказа.
- Финансовый partial PUT, missing-order 404, finance-row recovery и refresh карточки после save.
- JWT-защита вложений, Bearer для FormData/PDF, upload whitelist/signatures/rollback cleanup.
- Stored XSS на CRM/admin boundaries и сохранение причины отмены.
- Kanban prepayment, `lead` seed, startup error handling, SQL migration corruption и raw DB errors.
- Services batch transaction, login/contact throttling, PHP CSRF/session/file-write defects и hardcoded credentials.

### Архитектурные решения

- Calculator update вынесен в отдельный endpoint; при нескольких items сервер возвращает `409`, не выполняя replace-all.
- Scope idempotency key — пара `(actor_id, key)`; одинаковый payload replay-ится, иной payload конфликтует.
- Новая версия сервера требует применения обязательных versioned migrations и не изменяет рабочую схему автоматически.
- Startup guard проверяет `orders.version` и idempotency table до legacy compatibility DDL, поэтому запуск немигрированной рабочей БД не выполняет скрытых schema/data writes.
- Зафиксированы границы публичного сайта, CRM, Express API и MySQL, а также правила актуализации постоянного контекста.
- Зафиксировано требование сохранять API-контракты и бизнес-логику при визуальных изменениях.

## 2026-08-12

### Добавлено

- Поддержка поля типа изделия (`product_type`) в заказах, серверной схеме и карточке заказа.

## 2026-08-11

### Добавлено

- Хранение предоплаты, дополнительных данных клиента и графика дедлайнов заказа.
- Автоматический расчет и обновление дат этапов заказа.

### Изменено

- Смягчена проверка email клиента и обновлена серверная схема заказа.
- Упрощено редактирование данных клиента и дедлайнов в карточке заказа.

### Исправлено

- Исправлен SQL-запрос добавления столбца предоплаты при стартовой проверке схемы.

## 2026-08-10

### Добавлено

- API и экран клиентской базы с агрегированными показателями заказов.
- Каталог материалов и цен на основе CSV.
- Синхронизация справочника статусов заказов.
- Поддержка вложений и журнала действий по заказу.

### Изменено

- Backend разделен на маршруты, контроллеры, middleware, утилиты и worker генерации PDF.
- Расширены серверная валидация, JWT-аутентификация и обработка токена в CRM.

### Архитектурные решения

- Генерация PDF вынесена в worker thread.
- Финансовые данные заказа хранятся в целых денежных единицах минимального номинала в отдельной таблице.

## 2026-08-09

### Добавлено

- Создана исходная версия публичного сайта, CRM и Node.js backend.
