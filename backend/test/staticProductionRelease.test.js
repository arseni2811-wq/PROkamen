const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.resolve(__dirname, "..", "..", "public");

test("Apache release routing covers canonical and legacy public URLs", () => {
  const htaccess = fs.readFileSync(path.join(publicDir, ".htaccess"), "utf8");
  const requiredRoutes = [
    "catalog",
    "services",
    "works",
    "about",
    "contacts",
    "calculator",
    "stoleshnicy",
    "podokonniki",
    "materialy/kvarcevyj-aglomerat",
  ];
  for (const route of requiredRoutes) {
    assert.match(htaccess, new RegExp(`\\^${route.replace(/\//g, "\\/")}`));
  }
  assert.match(htaccess, /THE_REQUEST/);
  assert.match(htaccess, /pages\/works\/\$1\.html -f/);
});

test("maintenance calculator is noindex, static, and absent from sitemap", () => {
  const calculator = fs.readFileSync(
    path.join(publicDir, "pages", "calculator.html"),
    "utf8",
  );
  const sitemap = fs.readFileSync(path.join(publicDir, "sitemap.xml"), "utf8");

  assert.match(calculator, /<meta name="robots" content="noindex,follow"/);
  assert.match(calculator, /<h1[^>]*>Онлайн-калькулятор<\/h1>/);
  assert.match(calculator, /href="\/contacts\/"/);
  assert.doesNotMatch(calculator, /calculator-app\.js/);
  assert.doesNotMatch(calculator, /\/api\/calculator/);
  assert.doesNotMatch(sitemap, /https:\/\/prokamen\.by\/calculator\//);
  assert.equal((sitemap.match(/<loc>/g) || []).length, 28);
});
