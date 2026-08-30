const test = require("node:test");
const assert = require("node:assert/strict");

let currentOrders = [];
let financeRows = [];
let financeUpdateValues = null;
let financeInsertValues = null;
let historyValues = null;
const calls = { begin: 0, commit: 0, rollback: 0, release: 0 };

const connection = {
  async beginTransaction() {
    calls.begin += 1;
  },
  async commit() {
    calls.commit += 1;
  },
  async rollback() {
    calls.rollback += 1;
  },
  release() {
    calls.release += 1;
  },
  async query(sql, values = []) {
    if (sql.includes("FROM orders") && sql.includes("FOR UPDATE")) {
      return [currentOrders];
    }
    if (/UPDATE orders\s+SET/.test(sql)) return [{ affectedRows: 1 }];
    if (sql.includes("SELECT finance_id FROM order_finances")) {
      return [financeRows];
    }
    if (sql.includes("UPDATE order_finances")) {
      financeUpdateValues = values;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("INSERT INTO order_finances")) {
      financeInsertValues = values;
      return [{ insertId: 1 }];
    }
    if (sql.includes("INSERT INTO order_history_log")) {
      historyValues = values;
      return [{ insertId: 1 }];
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  },
};

const fakePool = {
  async getConnection() {
    return connection;
  },
};

const dbPath = require.resolve("../db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakePool,
};
const {
  updateOrder,
  updateOrderStatus,
} = require("../controllers/ordersController");

function resetState() {
  currentOrders = [];
  financeRows = [];
  financeUpdateValues = null;
  financeInsertValues = null;
  historyValues = null;
  Object.keys(calls).forEach((key) => {
    calls[key] = 0;
  });
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("partial prepayment update preserves finance total and calculator snapshot", async () => {
  resetState();
  currentOrders = [
    {
      order_id: 42,
      client_id: 7,
      status_id: "new",
      total_amount: "1000.00",
      prepayment: "100.00",
      exchange_rate: "3.0000",
      calculator_snapshot: JSON.stringify({
        isInitialized: true,
        matUSD: 10,
        prodUSD: 5,
      }),
      version: 1,
    },
  ];
  financeRows = [{ finance_id: 9 }];
  const req = {
    params: { id: "42" },
    validatedBody: { version: 1, prepayment: 250 },
    user: { user_id: 3, role_id: 2 },
  };
  const res = createResponse();

  await updateOrder(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(financeUpdateValues, [
    100000,
    25000,
    75000,
    3000,
    1500,
    "3.0000",
    JSON.stringify({ isInitialized: true, matUSD: 10, prodUSD: 5 }),
    "42",
  ]);
  assert.equal(calls.commit, 1);
  assert.equal(calls.rollback, 0);
});

test("partial financial update recreates a missing finance mirror", async () => {
  resetState();
  currentOrders = [
    {
      order_id: 42,
      client_id: 7,
      status_id: "new",
      total_amount: "1000.00",
      prepayment: "100.00",
      exchange_rate: null,
      calculator_snapshot: null,
      version: 1,
    },
  ];
  const req = {
    params: { id: "42" },
    validatedBody: { version: 1, total_amount: 1200 },
    user: { user_id: 3, role_id: 2 },
  };
  const res = createResponse();

  await updateOrder(req, res);

  assert.equal(res.body.success, true);
  assert.deepEqual(financeInsertValues, [
    "42",
    0,
    0,
    120000,
    10000,
    110000,
    null,
    "{}",
  ]);
});

test("update of a missing order returns 404 and rolls back", async () => {
  resetState();
  const req = {
    params: { id: "999999" },
    validatedBody: { total_amount: 50 },
    user: { user_id: 3, role_id: 2 },
  };
  const res = createResponse();

  await updateOrder(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(calls.rollback, 1);
  assert.equal(calls.commit, 0);
  assert.equal(calls.release, 1);
});

test("stale order version returns 409 without financial writes", async () => {
  resetState();
  currentOrders = [{
    order_id: 42,
    client_id: 7,
    status_id: "new",
    total_amount: "1000.00",
    prepayment: "100.00",
    exchange_rate: null,
    calculator_snapshot: null,
    version: 2,
  }];
  const req = {
    params: { id: "42" },
    validatedBody: { version: 1, prepayment: 200 },
    user: { user_id: 3, role_id: 2 },
  };
  const res = createResponse();
  await updateOrder(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(financeUpdateValues, null);
  assert.equal(financeInsertValues, null);
  assert.equal(calls.rollback, 1);
});

test("status and cancellation reason are committed with one audit entry", async () => {
  resetState();
  currentOrders = [{ order_id: 42, status_id: "new", version: 1 }];
  const req = {
    params: { id: "42" },
    validatedBody: {
      status_id: "cancelled",
      comment: "Клиент отказался",
      version: 1,
    },
    user: { user_id: 3, role_id: 2 },
  };
  const res = createResponse();

  await updateOrderStatus(req, res);

  assert.equal(res.body.success, true);
  assert.deepEqual(historyValues, [
    "42",
    "Смена статуса",
    "Статус изменен: new → cancelled. Комментарий: Клиент отказался",
    3,
  ]);
  assert.equal(calls.commit, 1);
  assert.equal(calls.rollback, 0);
  assert.equal(calls.release, 1);
});
