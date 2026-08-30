const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-not-for-production";
const fakePool = {
  async query() {
    return [[{ order_id: 42, manager_id: 2 }]];
  },
};
const dbPath = require.resolve("../db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakePool,
};
const { authenticateJWT } = require("../middleware/auth");
const { authorizeAttachmentDownload } = require("../middleware/orderAccess");

function request(port, pathname, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

test("attachment static route rejects anonymous and serves authorized requests", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prokamen-attachment-"));
  const orderDir = path.join(tempDir, "orders", "42");
  fs.mkdirSync(orderDir, { recursive: true });
  fs.writeFileSync(path.join(orderDir, "fixture.pdf"), "%PDF-fixture");
  const app = express();
  app.use(
    "/uploads",
    authenticateJWT,
    authorizeAttachmentDownload,
    express.static(tempDir),
  );
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const adminToken = jwt.sign({ user_id: 1, role_id: 1 }, process.env.JWT_SECRET);
  const ownerToken = jwt.sign({ user_id: 2, role_id: 2 }, process.env.JWT_SECRET);
  const foreignToken = jwt.sign({ user_id: 3, role_id: 2 }, process.env.JWT_SECRET);

  try {
    const pathname = "/uploads/orders/42/fixture.pdf";
    const anonymous = await request(port, pathname);
    const admin = await request(port, pathname, adminToken);
    const owner = await request(port, pathname, ownerToken);
    const foreign = await request(port, pathname, foreignToken);
    const traversal = await request(port, "/uploads/orders/42/%2e%2e/package.json", adminToken);
    assert.equal(anonymous.status, 401);
    assert.equal(admin.status, 200);
    assert.equal(owner.status, 200);
    assert.equal(foreign.status, 403);
    assert.equal(admin.body.toString(), "%PDF-fixture");
    assert.notEqual(traversal.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
