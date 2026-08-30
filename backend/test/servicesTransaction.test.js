const test = require("node:test");
const assert = require("node:assert/strict");

let queryIndex = 0;
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
  async query(sql) {
    if (sql.startsWith("SHOW TABLES")) return [[{ table: "dict_services" }]];
    if (sql.startsWith("SELECT service_id")) {
      queryIndex += 1;
      return queryIndex === 1 ? [[{ service_id: 1 }]] : [[]];
    }
    if (sql.startsWith("UPDATE dict_services")) return [{ affectedRows: 1 }];
    if (sql.startsWith("INSERT INTO dict_services")) {
      throw new Error("simulated insert failure");
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
const fakePool = { async getConnection() { return connection; } };
const dbPath = require.resolve("../db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakePool,
};
const { updateServices } = require("../controllers/materialsController");

test("service batch rolls back when a later write fails", async () => {
  queryIndex = 0;
  Object.keys(calls).forEach((key) => { calls[key] = 0; });
  const req = { validatedBody: { services: { existing: 10, new_service: 20 } } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await updateServices(req, res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);
  assert.equal(calls.begin, 1);
  assert.equal(calls.commit, 0);
  assert.equal(calls.rollback, 1);
  assert.equal(calls.release, 1);
});
