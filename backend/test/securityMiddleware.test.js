const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { createRateLimit } = require("../middleware/rateLimit");
const { requestContext } = require("../middleware/requestContext");

function response() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

test("rate limiter returns 429 and Retry-After after the configured limit", () => {
  const middleware = createRateLimit({
    windowMs: 60000,
    max: 2,
    keyGenerator: (req) => req.ip,
  });
  const req = { ip: "127.0.0.1" };
  let nextCalls = 0;
  middleware(req, response(), () => { nextCalls += 1; });
  middleware(req, response(), () => { nextCalls += 1; });
  const blocked = response();
  middleware(req, blocked, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["Retry-After"]) >= 1);
});

test("request context emits a UUID response header", () => {
  const req = { method: "GET", originalUrl: "/api/health?secret=no", path: "/api/health" };
  const res = response();
  let nextCalled = false;
  const originalLog = console.log;
  console.log = () => {};
  try {
    requestContext(req, res, () => { nextCalled = true; });
    res.emit("finish");
  } finally {
    console.log = originalLog;
  }

  assert.equal(nextCalled, true);
  assert.match(
    res.headers["X-Request-ID"],
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
