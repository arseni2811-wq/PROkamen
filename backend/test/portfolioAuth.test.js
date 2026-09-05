const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET = process.env.JWT_SECRET || "portfolio-test-secret";
const fakePool = { async query() { return [[]]; } };
require.cache[require.resolve("../db")] = { id: require.resolve("../db"), filename: require.resolve("../db"), loaded: true, exports: fakePool };
const routes = require("../routes/portfolio.routes");

function request(port, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: "/api/admin/portfolio",
      headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
      res.resume(); res.on("end", () => resolve(res.statusCode));
    }); req.on("error", reject); req.end();
  });
}
test("portfolio API permits admins only", async () => {
  const app = express(); app.use("/api/admin/portfolio", routes);
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    assert.equal(await request(port), 401);
    assert.equal(await request(port, jwt.sign({ user_id: 2, role_id: 2 }, process.env.JWT_SECRET)), 403);
    assert.equal(await request(port, jwt.sign({ user_id: 1, role_id: 1 }, process.env.JWT_SECRET)), 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
