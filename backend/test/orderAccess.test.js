const test = require("node:test");
const assert = require("node:assert/strict");

let storedOrder = { order_id: 42, manager_id: 7 };
const fakePool = {
  async query() {
    return [storedOrder ? [storedOrder] : []];
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
  authorizeOrderCollection,
  authorizeProductionRead,
  authorizeOrderObject,
} = require("../middleware/orderAccess");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function objectAccess(user) {
  const req = { params: { id: "42" }, user };
  const res = response();
  let allowed = false;
  await authorizeOrderObject(req, res, () => { allowed = true; });
  return { allowed, res };
}

test("admin may access a manager-owned order", async () => {
  const result = await objectAccess({ user_id: 1, role_id: 1 });
  assert.equal(result.allowed, true);
});

test("manager may access own order but not a foreign order", async () => {
  const own = await objectAccess({ user_id: 7, role_id: 2 });
  const foreign = await objectAccess({ user_id: 8, role_id: 2 });
  assert.equal(own.allowed, true);
  assert.equal(foreign.allowed, false);
  assert.equal(foreign.res.statusCode, 403);
});

test("worker is restricted to production collection", async () => {
  const object = await objectAccess({ user_id: 9, role_id: 3 });
  const collectionRes = response();
  let collectionAllowed = false;
  authorizeOrderCollection(
    { user: { user_id: 9, role_id: 3 } },
    collectionRes,
    () => { collectionAllowed = true; },
  );
  let productionAllowed = false;
  authorizeProductionRead(
    { user: { user_id: 9, role_id: 3 } },
    response(),
    () => { productionAllowed = true; },
  );
  assert.equal(object.res.statusCode, 403);
  assert.equal(collectionAllowed, false);
  assert.equal(collectionRes.statusCode, 403);
  assert.equal(productionAllowed, true);
});

test("missing order returns 404 before ownership decision", async () => {
  storedOrder = null;
  const result = await objectAccess({ user_id: 1, role_id: 1 });
  assert.equal(result.allowed, false);
  assert.equal(result.res.statusCode, 404);
});
