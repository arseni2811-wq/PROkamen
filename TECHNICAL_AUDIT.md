# Полный технический аудит «ПРО Камень»

Дата: 2026-08-28

## Этап 2 — закрытие Critical/High (2026-08-29)

Закрыты четыре согласованных риска: серверная объектная авторизация заказов, атомарная синхронизация calculator snapshot с единственным отображаемым UI item и finance mirror, optimistic locking и транзакционная идемпотентность `POST /orders`.

Фактическая матрица теперь такова: admin имеет доступ ко всем заказам; manager — только к заказам с собственным `manager_id`; worker — только к обезличенной производственной проекции без клиента и финансов. Ownership применяется к detail/update/status/calculator/PDF/history/attachments/upload и скачиванию файла. Для существующего, но чужого заказа возвращается `403`, для отсутствующего — `404`; anonymous получает `401`.

Текущий UI калькулятора создаёт и отображает один item. Специальный `PUT /api/orders/:id/calculator` в одной транзакции обновляет snapshot, material/stone, dimensions, area, edge/profile, item values, total, finance mirror, history и `version`. Если в заказе несколько items, операция возвращает `409` и ничего не заменяет.

Добавлены миграции `003_orders_version.sql` и `004_order_idempotency.sql`. Существующая схема принимается как baseline только явной командой; рабочая БД автоматически не менялась. Проверены чистое развёртывание четырёх миграций и legacy deployment `baseline adoption → 002 → 003 → 004`.

Итоговая регрессия: `npm test` — 27/27, `npm run verify:full` — passed, clean/legacy DB deployment — passed, полный HTTP/security/finance integration — passed, `npm audit --omit=dev` — 0 vulnerabilities, оба diff checks — passed.

Оставшиеся High-риски из исходного аудита ограничены production rollout миграций и шестью историческими финансовыми аномалиями, которые намеренно не исправлялись. Для нескольких items требуется отдельное UX/бизнес-решение; для idempotency table — retention policy. Риски Git history, status policy, startup compatibility DDL и инфраструктурные Medium/Low остаются без изменения.

## 1. Итог

Проверен полный контур Express/MySQL/CRM/PHP. Исправлены подтверждённые дефекты финансового partial PUT, защиты вложений, stored XSS, Bearer-аутентификации FormData/PDF, транзакций, валидации, миграций, rate limiting, логирования и секретов. Создана воспроизводимая baseline-схема и сквозной тест на отдельной БД. Рабочая MySQL использовалась только для `SELECT`/`SHOW`; данные не менялись.

После этапа 2 полный прогон успешен: 27/27 Node-тестов, syntax/static checks, миграции чистой и legacy БД и расширенный HTTP integration. `npm audit --omit=dev` сообщает 0 уязвимостей.

Объектная авторизация, синхронизация calculator/item/finance, optimistic locking и idempotency закрыты на этапе 2. Нерешёнными остаются production rollout миграций, источник истины для шести исторических финансовых аномалий и отдельный UX для нескольких items.

## 2. Что проверено

- JWT/cookie, login/logout, роли и все order endpoints.
- Создание, чтение, частичное изменение, статус, история, финансы, PDF и вложения.
- CRM output boundaries: order, kanban, clients, production, archive, admin, services/materials и calculator.
- Фактическая схема и целостность рабочей MySQL без персональных данных.
- Пустая MySQL: baseline → incremental migration → seed → startup → E2E.
- PHP admin/contact handlers, сессии, CSRF, rate limit, file writes и логи.
- Git index, uploads, `.env` patterns и встроенные учётные данные.
- Все локальные `src`/`href` в 18 HTML-файлах; пропусков нет.
- Внешние зависимости: Tailwind CDN, html2pdf CDN, Google Fonts, Yandex Metrika/Maps.
- Production npm dependencies и синтаксис всех `.js` вне `node_modules`.

PHP CLI в окружении отсутствует, поэтому `php -l` не выполнялся. PHP был проверен статически.

## 3. Что исправлено

| Проблема и причина | Исправление | Проверка |
|---|---|---|
| Partial PUT подставлял `0` вместо отсутствующих финансовых полей | `SELECT ... FOR UPDATE`, merge текущих/новых значений, сохранение snapshot, восстановление missing finance row | regression: 1000/100 + `prepayment=250` → 100000/25000/75000 |
| PUT отсутствующего заказа мог выглядеть успешным | предварительная блокировка строки, 404 и rollback | unit regression |
| UI после save доверял устаревшим aliases | повторный `GET /orders/:id` и рендер серверного состояния | browser/API regression + E2E reload |
| `/uploads` был публичной статикой | JWT перед static; same-origin URLs; Bearer поддерживается | anonymous 401, Bearer 200, traversal не 200 |
| Предсказуемый JWT fallback | `JWT_SECRET` обязателен; production cookie Secure/HttpOnly/SameSite | middleware/security tests |
| Stored XSS через `innerHTML` и inline handlers | escaping только на HTML boundary, `textContent`, безопасные listeners; числовая нормализация snapshot | `<img src=x onerror=alert(1)>` rendering regression и E2E JSON boundary |
| Upload доверял расширению и оставлял orphan files при DB failure | extension whitelist, magic bytes, safe generated name, 50 MiB, existing order, transaction, rollback cleanup, configurable test storage | signature unit tests + upload E2E |
| FormData/PDF теряли Bearer token | единый auth header для JSON, FormData и PDF | browser API tests + E2E без cookie |
| Причина отмены терялась | bounded comment сохраняется с status в одной транзакции/history | unit regression |
| Канбан всегда видел предоплату `0` | list query возвращает `prepayment` | kanban rendering test |
| `lead` отсутствовал в seed | единый seed из 12 статусов | migration/startup test |
| Сервер мог слушать после ошибки DDL | `startServer()` ждёт schema preparation; listen только после успеха; модуль можно тестировать | clean DB startup E2E |
| Sprint SQL содержал посторонний текст | миграция очищена | SQL execution on test DB |
| API раскрывал raw MySQL errors | нейтральные 500-ответы, подробности только server-side | code audit; health также не раскрывает `err.message` |
| Batch services был нетранзакционным | connection + BEGIN/COMMIT/ROLLBACK/release | simulated middle-write failure |
| Не было rate limit | login per-IP и per-IP+login, contact form per-IP, 429 + Retry-After | middleware regression |
| PHP admin имел встроенный пароль, слабую сессию, no CSRF и неатомарную JSON-запись | обязательный password hash из env, secure session cookie, CSRF, throttling, atomic temp+rename+LOCK_EX | static audit; PHP lint недоступен |
| PHP contact логировал отправителя и имел hardcoded recipient | recipient из env, PII удалена из error log, rate limit | static audit |
| `init-users.js` содержал пароли и удалял всех пользователей | обязательные env passwords + `ALLOW_USER_RESEED=1`; безопасный upsert вместо delete | secret scan + JS syntax |
| Обычный manager мог подменить `manager_id` при POST | manager всегда назначает себя; произвольное назначение оставлено только admin | E2E manager spoof test |
| Неверные client/product/edge IDs уходили в FK 500 | явные reference checks и 404 до insert/delete items | E2E unknown client; code path for item refs |
| Нет request correlation | UUID `X-Request-ID` и JSON access log с route/method/status/latency/actor/order без PII/token | middleware unit + E2E header/logs |
| Нет воспроизводимой схемы | `schema_migrations`, `001_baseline.sql`, `002_unique_order_finances.sql`, guarded runner | empty DB test and idempotent rerun |
| `order_finances.order_id` допускал дубли | incremental UNIQUE migration подготовлена и проверена только на test DB | information_schema assertion |
| Uploads и `.DS_Store` были tracked | `.gitignore`; 4 uploads и `.DS_Store` удалены только из Git index, файлы сохранены на диске | `git ls-files` empty + filesystem existence check |
| Не было backup/restore процесса | runbook с encryption, retention, offsite, RPO/RTO и restore drill | documentation review |

## 4. Что осталось

### Critical

- Старые пароли и клиентские uploads могут оставаться в Git history/remotes, хотя из текущего index они удалены. Нужны ротация паролей и отдельно согласованный history rewrite.

### High

- Шесть исторических финансовых аномалий рабочей БД не исправлены. Нужны backup/restore test, подтверждение источника истины и before/after backfill на копии.
- Рабочая БД ещё не получила миграции 002–004; новая версия сервера намеренно требует их перед запуском.

### Medium

- `statusTransitions` описывает строгий flow, но фактическая утверждённая UI-политика позволяет любой переход между известными статусами. Текущий тест фиксирует именно это поведение; строгую карту нельзя включать без бизнес-решения.
- History хранит actor/action/description, но не структурированные old/new и request ID.
- Startup DDL всё ещё существует для совместимости старой рабочей БД. Новые установки должны использовать migration runner; в дальнейшем startup DDL следует удалить после rollout.
- Материал с неизвестным `material_id` всё ещё автоматически создаётся как quartz/нулевая цена — существующее бизнес-поведение, требующее подтверждения.
- Адрес клиента и адрес монтажа смешиваются при создании, но имеют разные колонки.
- In-memory Node rate limiter не разделяется между несколькими процессами; production cluster потребует Redis/proxy limiter.

### Low

- Tailwind `cdn.tailwindcss.com` и html2pdf `cdnjs` не self-hosted; закрытая сеть/офлайн CRM не поддерживаются.
- Нет ESLint/Prettier/typecheck. Текущий quality gate использует tests, `node --check`, static reference check и npm audit.
- PDF worker пишет стартовый debug log на каждый запуск.
- Нет автоматического PHP lint в текущем окружении.

## 5. Тесты

- `npm test`: **27/27 passed**.
- `npm run check:syntax`: passed для всех backend/public `.js`.
- `npm run check:static`: 18 HTML, missing local references = 0.
- `npm run test:migrations`: 4 clean-DB migrations and legacy baseline adoption + 3 incremental migrations passed; rerun idempotent.
- `npm run test:integration`: passed lifecycle, ownership/PDF/attachment authorization, worker projection, calculator consistency, optimistic locking, sequential/concurrent idempotency and finance invariants.
- `npm run verify:full`: passed.
- `git diff --check`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.

## 6. База данных

READ-ONLY результаты рабочей БД:

| Проверка | Значение |
|---|---:|
| orders | 14 |
| missing finance rows | 4 |
| finance mismatches | 2 |
| duplicate finance orders | 0 |
| orphan items | 0 |
| orphan attachments | 0 |

Обезличенные аномалии:

| Order | Тип | orders total/prepayment | finance revenue/prepayment/balance | Snapshot | History |
|---:|---|---|---|---|---|
| 6 | missing finance | 981 / 0 | — | нет | нет |
| 8 | missing finance | 917 / 0 | — | нет | нет |
| 9 | missing finance | 917 / 100 | — | нет | нет |
| 10 | missing finance | 1397 / 0 | — | нет | нет |
| 15 | mismatch | 10000000 / 100000 | 10000000 / 100000 / 9900000 cents | есть | есть |
| 31 | mismatch | 1000 / 0 | 100000 / 10000 / 90000 cents | нет | есть |

Никаких UPDATE/DELETE/DDL на рабочей БД не выполнялось. Нулевые costs не подставлялись.

## 7. Миграции

Проверенный deployment:

```text
empty database
→ 001_baseline.sql
→ 002_unique_order_finances.sql
→ 003_orders_version.sql
→ 004_order_idempotency.sql
→ second migration run (no-op)
→ seed/status verification
→ application startup on random local port
→ full HTTP integration scenario
→ database drop
```

Также проверен legacy deployment: исходная baseline-схема → явный `migrate:adopt-baseline` → миграции 002–004. Runner требует `ALLOW_SCHEMA_MIGRATIONS=1` и выполняет только файлы `NNN_*.sql`. На рабочую БД миграции 002–004 не применялись.

## 8. Безопасность и фактическая матрица ролей

| Операция | admin (1) | manager (2) | worker (3) | иной valid role |
|---|---|---|---|---|
| Список/detail/update/status/PDF/upload/history | да, все | только собственные | нет | нет |
| Production projection без клиента/финансов | да | только собственные | да, производственная очередь | нет |
| Attachment metadata/download | да, все | только собственные | нет | нет |
| Назначить чужой manager при POST | да | нет | нет | нет |
| Read clients/services/rate | да | да | нет | нет |
| Read materials | да | да | да | нет |
| Update materials/services | да | да | нет | нет |
| Delete material / update exchange rate | да | нет | нет | нет |

- JWT: обязательный secret; anonymous/invalid token rejected.
- XSS: CRM boundaries исправлены и покрыты regression; HTML admin inline handlers для динамических IDs удалены.
- Upload: extension + signature + size + generated filename + transaction/cleanup.
- Attachments/PDF: Bearer-only сценарий работает; anonymous rejected; ownership проверяется до выдачи metadata/file/PDF.
- Rate limiting: Node login и PHP contact/admin.
- PHP: hardcoded admin password удалён; env hash + CSRF + secure sessions. PHP lint не выполнялся.
- Secrets: исходные seed-пароли удалены из рабочей версии; требуется ротация из-за Git history.
- Git: uploads больше не tracked, но физические файлы оставлены владельцу.

## 9. Изменённые файлы

Backend:

- `controllers/{auth,clients,materials,orders,settings}Controller.js`
- `db.js`, `server.js`, `init-users.js`, `test_sprint1.js`, `package.json`
- `middleware/auth.js`, `schemas.js`, новые `rateLimit.js`, `requestContext.js`
- новый `middleware/orderAccess.js`
- `routes/auth.routes.js`, `orders.routes.js`
- `utils/seedStatuses.js`, новый `fileSignatures.js`
- `migrations/sprint2_tables.sql`, новые `001_baseline.sql`, `002_unique_order_finances.sql`, `003_orders_version.sql`, `004_order_idempotency.sql`
- новые scripts: migrate, baseline adoption, migration test, integration test, integrity/static/anomaly checks
- новые tests: object/attachment auth, browser API, signatures, kanban, orders, schemas, security middleware, services transaction, state machine

Frontend/PHP:

- `public/crm/crm/js/{admin,api,archive,clients,kanban,order,production}.js`
- `public/pages/admin.html`
- `public/php/{admin_handler,config,send-mail}.php`

Repository/docs:

- `.gitignore`, `TECHNICAL_AUDIT.md`, `CONTEXT.md`, `TODO.md`, `CHANGELOG.md`
- `docs/BACKUP_AND_RESTORE.md`
- `.DS_Store` and four `backend/uploads` files removed from Git index only

Пользовательская нормализация дат в `public/crm/crm/js/order.js` сохранена.

## 10. Новые тестовые сценарии

1. Partial finance merge and missing finance recreation.
2. Missing order 404/rollback.
3. XSS escaping boundary.
4. Attachment JWT and traversal.
5. Upload signature/extension validation.
6. Bearer FormData and PDF.
7. Cancellation comment in transaction.
8. Kanban prepayment.
9. Login rate limit and request ID.
10. Services batch rollback.
11. Calendar dates, varchar limits and strict items schema.
12. Current permissive state policy and unknown status rejection.
13. Clean DB migrations and rerun.
14. E2E order lifecycle, valid PDF bytes and database invariants.
15. SQL-like login/ID payloads and invalid IDs.
16. Manager ID spoof rejection and unknown client 404.
17. Admin/manager/worker object authorization, foreign attachments and PDF.
18. Calculator snapshot/order item/order finance atomic consistency and multi-item conflict.
19. Optimistic locking with stale `version` conflict.
20. Sequential and concurrent `Idempotency-Key` replay and changed-payload conflict.

## 11. Команды проверки

```bash
cd backend
npm ci
npm run verify:full
npm audit --omit=dev
npm run check:integrity
npm run report:finance-anomalies
git diff --check
git diff --cached --check
```

`test:migrations` и `test:integration` создают и удаляют только явно именованные временные БД. `check:integrity` и `report:finance-anomalies` выполняют только SELECT.

## 12. Вопросы, требующие бизнес-решения

1. Точная матрица admin/manager/worker для чтения, изменения, статусов, PDF и вложений чужого заказа.
2. Один ли calculator snapshot соответствует ровно одному item, либо UI должен редактировать несколько позиций.
3. Строгий ли workflow статусов нужен вместо свободного kanban.
4. Какой источник истины утверждён для шести существующих финансовых аномалий.
5. Являются ли `client.address` и `orders.installation_address` разными значениями.
