const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.resolve(__dirname, "..", "..", "public");

test("public header uses the compact crawlable navigation", () => {
  const main = fs.readFileSync(path.join(publicDir, "js", "main.js"), "utf8");
  const requiredLinks = [
    "/catalog/",
    "/stoleshnicy/",
    "/stoleshnicy/dlya-kuhni/",
    "/stoleshnicy/dlya-vannoy/",
    "/stoleshnicy/iz-kvarca/",
    "/podokonniki/",
    "/services/",
    "/works/",
    "/about/",
    "/contacts/",
  ];

  for (const href of requiredLinks) {
    assert.match(main, new RegExp(`href="${href.replace(/[/?]/g, "\\$&")}"`));
  }
  assert.match(main, /aria-controls="products-menu"/);
  assert.match(main, /aria-expanded="false"/);
  assert.match(main, /e\.key === "Escape"/);
  assert.match(main, /Получить расчёт/);
  assert.doesNotMatch(main, /href="\/calculator\/"[^\n]*>Калькулятор/);
  assert.doesNotMatch(main, /href="\/"[^\n]*>Главная/);
});

test("catalog and quartz landing create reciprocal crawlable links", () => {
  const catalog = fs.readFileSync(path.join(publicDir, "pages", "catalog.html"), "utf8");
  const landing = fs.readFileSync(path.join(publicDir, "js", "landing.js"), "utf8");

  assert.match(catalog, /href="\/materialy\/kvarcevyj-aglomerat\/"/);
  assert.match(landing, /"\/catalog\/"/);
  assert.match(landing, /"\/stoleshnicy\/iz-kvarca\/"/);
  assert.match(landing, /"\/works\/"/);
});
