const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

test("kanban payment badge uses prepayment returned by list API", () => {
  const context = vm.createContext({
    document: { addEventListener() {} },
    window: { location: { pathname: "/crm/crm/dashboard.html" } },
    Store: {},
    api: {},
    console,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(
    fs.readFileSync(
      path.resolve(__dirname, "../../public/crm/crm/js/kanban.js"),
      "utf8",
    ),
    context,
  );
  const badge = vm.runInContext(
    `getPaymentBadge({ total_amount: 1000, prepayment: 250 })`,
    context,
  );
  assert.match(badge, /Частично/);
});
