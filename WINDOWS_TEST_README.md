# ПРО Камень — Windows test environment

This setup is local and uses **only** `pro_erp_test`. Never place `pro_erp` or production credentials in `backend/.env` on Windows.

## First launch

1. Install Node.js LTS and MySQL Server with the `MySQL80` service.
2. Create `backend/.env` from the local test values. It must set both `DB_NAME` and `DB_DATABASE` to `pro_erp_test`, plus a local `JWT_SECRET`.
3. In `backend`, run `npm ci`.
4. Confirm MySQL80 is running and `pro_erp_test` already contains the CRM schema.
5. Run `npm run db:seed:test` to create the non-production `test-admin` account. Its password is the local `TEST_ADMIN_PASSWORD` from `backend/.env`.

## Normal launch

Double-click `START_TEST_WINDOWS.bat`. It starts MySQL80 when possible and opens one console for the backend. The frontend is served by the backend; no second frontend process is required.

Open <http://localhost:3000/crm/crm/login.html>.

## Check

Double-click `CHECK_TEST_WINDOWS.bat`. It reports MySQL80, ports 3306 and 3000, and `GET /api/health`. The health response must contain `"dbName":"pro_erp_test"`.

## Stop

Run `STOP_TEST_WINDOWS.bat`. It stops only the process tree whose PID was created by the test launcher; it does not stop MySQL80 or unrelated `node.exe` processes.

## Safety

- `.env` is ignored by Git.
- Windows development/test startup refuses every database name other than `pro_erp_test`.
- Do not run migrations against an existing test schema unless you explicitly intend to change that test schema.
