const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createBrowserContext(fetchImpl = null) {
  const requests = [];
  class FakeFormData {
    constructor() { this.values = []; }
    append(name, value) { this.values.push([name, value]); }
  }
  const context = vm.createContext({
    window: {
      location: {
        port: "3000",
        origin: "http://localhost:3000",
        protocol: "http:",
        hostname: "localhost",
        pathname: "/crm/crm/order.html",
      },
    },
    localStorage: {
      getItem(key) { return key === "crm_token" ? "bearer-token" : null; },
      removeItem() {},
      setItem() {},
    },
    FormData: FakeFormData,
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (fetchImpl) return fetchImpl(url, options);
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        blob: async () => Buffer.from("%PDF-test"),
      };
    },
    alert() {},
    console,
    Buffer,
    URL,
    Error,
    Date,
    setTimeout,
    clearTimeout,
  });
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../public/crm/crm/js/api.js"),
    "utf8",
  );
  vm.runInContext(source, context);
  return { context, requests };
}

test("HTML escaping happens at the rendering boundary", () => {
  const { context } = createBrowserContext();
  const escaped = vm.runInContext(
    `escapeHtml('<img src=x onerror="alert(1)">')`,
    context,
  );
  assert.equal(
    escaped,
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
});

test("Bearer auth is retained for FormData upload", async () => {
  const { context, requests } = createBrowserContext();
  await vm.runInContext(
    `api.uploadFiles(42, [{ name: 'drawing.pdf' }], 'document')`,
    context,
  );
  assert.equal(requests[0].options.headers.Authorization, "Bearer bearer-token");
  assert.equal(requests[0].options.headers["Content-Type"], undefined);
  assert.equal(requests[0].options.headers.Accept, "application/json");
});

test("Idempotency-Key does not replace JSON content headers", async () => {
  const { context, requests } = createBrowserContext();
  await vm.runInContext(
    `api.createOrder({ total_amount: 721 }, 'create-order-key')`,
    context,
  );
  assert.equal(
    requests[0].options.headers["Content-Type"],
    "application/json",
  );
  assert.equal(requests[0].options.headers.Accept, "application/json");
  assert.equal(requests[0].options.headers.Authorization, "Bearer bearer-token");
  assert.equal(requests[0].options.headers["Idempotency-Key"], "create-order-key");
  assert.equal(requests[0].options.body, JSON.stringify({ total_amount: 721 }));
});

test("Bearer auth is sent for PDF download without a cookie", async () => {
  const { context, requests } = createBrowserContext();
  await vm.runInContext(`api.downloadPdf(42)`, context);
  assert.equal(requests[0].options.headers.Authorization, "Bearer bearer-token");
});

test("Bearer auth is sent for attachment download without a cookie", async () => {
  const { context, requests } = createBrowserContext();
  await vm.runInContext(`api.downloadAttachment(42, 7)`, context);
  assert.equal(
    requests[0].url,
    "http://localhost:3000/api/orders/42/attachments/7/download",
  );
  assert.equal(requests[0].options.headers.Authorization, "Bearer bearer-token");
});

test("attachment delete uses authenticated DELETE request", async () => {
  const { context, requests } = createBrowserContext();
  await vm.runInContext(`api.deleteAttachment(42, 7)`, context);
  assert.equal(
    requests[0].url,
    "http://localhost:3000/api/orders/42/attachments/7",
  );
  assert.equal(requests[0].options.method, "DELETE");
  assert.equal(requests[0].options.headers.Authorization, "Bearer bearer-token");
});

test("API validation errors identify the human-readable form field", async () => {
  const { context } = createBrowserContext(async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      message: "Ошибка валидации",
      details: [
        {
          path: ["client", "full_name"],
          message: "Too big: expected string to have <=100 characters",
        },
      ],
    }),
  }));

  await assert.rejects(
    vm.runInContext(`api.createOrder({ client: { full_name: 'x' } })`, context),
    /ФИО клиента: Too big/,
  );
});
