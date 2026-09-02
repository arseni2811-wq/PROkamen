"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculatorPriceDecision, cleanDecorName, fractionalPrice, normalizeRow, parseDimensions, rebuildIdentities } = require("../services/materialImportService");
const { calculateMaterial } = require("../services/calculatorService");

function source(overrides = {}) {
  return {
    "Бренд": "Belenco", "Категория": "Кварцевый агломерат", "Артикул": "4043",
    "Наименование": "Aizano", "Размер": "NORMAL", "Толщина": "20 мм",
    "Поверхность": 610, "Цена": null, "Валюта": "EUR", "Единица": "слэб",
    "Цена 1/2": 315, "Цена 1/4": 185, "Тип цены": "ОПТ1", "НДС": "с НДС 20%",
    "Примечание": "", "Источник": "", "Место в источнике": "лист BELENCO, строка данных 55",
    ...overrides,
  };
}

test("NORMAL and НОРМАЛ map to 3050×1440", () => {
  for (const value of ["NORMAL", "НОРМАЛ"]) {
    const result = parseDimensions(value, "20 мм");
    assert.deepEqual([result.lengthMm, result.widthMm, result.thicknessMm], [3050, 1440, 20]);
    assert.equal(result.dimensionSource, "mapped_normal");
  }
});

test("JUMBO maps to 3200×1600", () => {
  const result = parseDimensions("JUMBO", "20 мм");
  assert.deepEqual([result.lengthMm, result.widthMm, result.thicknessMm], [3200, 1600, 20]);
  assert.equal(result.dimensionSource, "mapped_jumbo");
});

test("SUPER JUMBO aliases map to 3300×1650", () => {
  for (const value of ["SUPER JUMBO", "SUPER_JUMBO"]) {
    const result = parseDimensions(value, "20 мм");
    assert.deepEqual([result.lengthMm, result.widthMm, result.thicknessMm], [3300, 1650, 20]);
    assert.equal(result.dimensionSource, "mapped_super_jumbo");
  }
});

test("explicit dimensions take priority over a commercial label", () => {
  const result = parseDimensions("3340х1640 – 20 мм JUMBO", "20 мм");
  assert.deepEqual([result.lengthMm, result.widthMm, result.thicknessMm], [3340, 1640, 20]);
  assert.equal(result.dimensionSource, "explicit");
});

test("a numeric value is not treated as a slab format", () => {
  const result = parseDimensions("1740", "20 мм");
  assert.equal(result.lengthMm, null);
  assert.equal(result.widthMm, null);
  assert.equal(result.commercialFormat, null);
});

test("shifted numeric Surface recovers FULL without becoming a surface", () => {
  const row = normalizeRow(source(), 2, "source.xlsx");
  assert.equal(row.prices.find((price) => price.fraction === 1).amountMinor, 61000);
  assert.equal(row.surface, null);
  assert.ok(row.warnings.includes("SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"));
});

test("OUT markers leave clean decor name and remain in sourceName", () => {
  for (const marker of ["OUT", "#OUT", "O U T", "выводится", "снят с производства"]) {
    const row = normalizeRow(source({ "Наименование": `White Misterio ${marker}` }), 2, "source.xlsx");
    assert.equal(row.name, "White Misterio");
    assert.equal(row.sourceName, `White Misterio ${marker}`);
    assert.equal(row.discontinued, true);
  }
  assert.equal(cleanDecorName("White Misterio OUT"), "White Misterio");
});

test("SETA moves to surface and does not change base decor", () => {
  const row = normalizeRow(source({ "Артикул": "1010", "Наименование": "Premium White SETA", "Размер": "JUMBO" }), 2, "source.xlsx");
  assert.equal(row.name, "Premium White");
  assert.equal(row.surface, "SETA");
  assert.equal(cleanDecorName("Cloudburst Concrete #Матовый!"), "Cloudburst Concrete");
});

test("same decor has one materialKey", () => {
  const normal = normalizeRow(source({ "Артикул": "1010", "Наименование": "Premium White", "Размер": "NORMAL" }), 2, "source.xlsx");
  const seta = normalizeRow(source({ "Артикул": "1010", "Наименование": "Premium White SETA", "Размер": "JUMBO" }), 3, "source.xlsx");
  rebuildIdentities([normal, seta], "source.xlsx");
  assert.equal(normal.materialKey, seta.materialKey);
});

test("different formats and surfaces have different variantKey", () => {
  const normal = normalizeRow(source({ "Артикул": "1010", "Наименование": "Premium White", "Размер": "NORMAL" }), 2, "source.xlsx");
  const jumbo = normalizeRow(source({ "Артикул": "1010", "Наименование": "Premium White", "Размер": "JUMBO" }), 3, "source.xlsx");
  const seta = normalizeRow(source({ "Артикул": "1010", "Наименование": "Premium White SETA", "Размер": "JUMBO" }), 4, "source.xlsx");
  rebuildIdentities([normal, jumbo, seta], "source.xlsx");
  assert.notEqual(normal.variantKey, jumbo.variantKey);
  assert.notEqual(jumbo.variantKey, seta.variantKey);
});

test("article/name conflicts are reported and not merged", () => {
  const first = normalizeRow(source({ "Артикул": "X1", "Наименование": "Decor Alpha" }), 2, "source.xlsx");
  const second = normalizeRow(source({ "Артикул": "X1", "Наименование": "Decor Beta" }), 3, "source.xlsx");
  assert.equal(rebuildIdentities([first, second], "source.xlsx").length, 1);
  assert.notEqual(first.materialKey, second.materialKey);
  assert.ok(first.warnings.includes("ARTICLE_NAME_CONFLICT"));
});

test("FULL, HALF and QUARTER stay independent", () => {
  const row = normalizeRow(source(), 2, "source.xlsx");
  assert.deepEqual(row.prices.map(({ fraction, amountMinor, currency }) => ({ fraction, amountMinor, currency })), [
    { fraction: 1, amountMinor: 61000, currency: "EUR" },
    { fraction: 0.5, amountMinor: 31500, currency: "EUR" },
    { fraction: 0.25, amountMinor: 18500, currency: "EUR" },
  ]);
});

test("0.5-step price composes explicit FULL and HALF through 3 slabs", () => {
  const prices = { 1: 61000, 0.5: 31500, 0.25: 18500 };
  assert.deepEqual([0.5, 1, 1.5, 2, 2.5, 3].map((count) => fractionalPrice(prices, count)),
    [31500, 61000, 92500, 122000, 153500, 183000]);
});

test("calculator rejects half-slab use without commercial HALF", () => {
  assert.throws(() => calculateMaterial({ priceUnit: "slab", basePriceUsdCents: 61000,
    fractionPricesUsdCents: { 1: 61000 }, markupBps: 0 }, 0.5, 0, 0, 0, 0), /отсутствует цена половины/);
});

test("suspicious HALF gets HIGH warning without correction", () => {
  const row = normalizeRow(source({ "Цена": 780, "Поверхность": "Глянцевая", "Цена 1/2": 26, "Валюта": "USD" }), 2, "source.xlsx");
  assert.equal(row.prices.find((price) => price.fraction === 0.5).amountMinor, 2600);
  assert.ok(row.warnings.some((warning) => warning.includes("HIGH suspicious_half_price")));
  const decision = calculatorPriceDecision(row);
  assert.equal(decision.calculatorReady, false);
  assert.equal(decision.calculatorAmountUsdCents(row.prices[0]), null);
  assert.equal(decision.isCalculatorPrice(row.prices[1]), false);
});

test("only safe USD FULL+HALF variant becomes calculator-ready", () => {
  const usd = normalizeRow(source({ "Цена": 610, "Поверхность": "polished", "Валюта": "USD" }), 2, "source.xlsx");
  const usdDecision = calculatorPriceDecision(usd);
  assert.equal(usdDecision.calculatorReady, true);
  assert.equal(usdDecision.calculatorAmountUsdCents(usd.prices[0]), 61000);
  assert.equal(usdDecision.isCalculatorPrice(usd.prices[1]), true);

  const eurDecision = calculatorPriceDecision(normalizeRow(source(), 3, "source.xlsx"));
  assert.equal(eurDecision.calculatorReady, false);
  assert.equal(eurDecision.calculatorAmountUsdCents({ currency: "EUR", amountMinor: 61000 }), null);
});

test("unknown format is rejected", () => {
  assert.ok(normalizeRow(source({ "Размер": "MEGA" }), 2, "source.xlsx").errors.includes("нет однозначных физических размеров слэба"));
});

test("missing thickness is rejected", () => {
  assert.ok(normalizeRow(source({ "Размер": "3200х1600", "Толщина": "" }), 2, "source.xlsx").errors.includes("нет толщины"));
});

test("migration 007 uses DECIMAL fractions, FKs and required indexes", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../migrations/007_material_variants_and_prices.sql"), "utf8");
  assert.match(sql, /quantity_fraction DECIMAL\(4,2\)/);
  assert.doesNotMatch(sql, /\bFLOAT\b/i);
  assert.match(sql, /idx_material_variants_material \(material_id, is_active\)/);
  assert.match(sql, /idx_material_variants_format \(slab_format_id\)/);
  assert.match(sql, /idx_material_prices_calculator/);
  assert.match(sql, /FOREIGN KEY \(material_variant_id\)/);
  assert.match(sql, /is_discontinued TINYINT\(1\)/);
});
