const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, roundSlabs } = require("../services/calculatorService");

function pricebook(rate = 3) {
  return {
    version: 1,
    exchangeRateScaled: rate * 10000,
    material: {
      id: "q-r104",
      category: "quartz",
      title: "Белая Тайга",
      priceUnit: "slab",
      basePriceUsdCents: 10000,
      markupBps: 0,
    },
    slabFormat: { code: "normal", lengthMm: 3050, widthMm: 1440, thicknessMm: 20 },
    settings: {
      reserveBps: 1000,
      publicFactorBps: 9500,
      minimumOrderBynCents: 0,
      roundingStepBynCents: 1000,
      wasteBps: 1000,
      minimumMaterialMarkupBps: 0,
    },
    rates: [
      { systemCode: "cut_straight", displayName: "Прямой раскрой", category: "production", unit: "m", basePriceUsdCents: 500, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "cut_curved", displayName: "Фигурный раскрой", category: "production", unit: "m", basePriceUsdCents: 0, calculationMode: "dependent", dependentCode: "cut_straight", percentBps: 13000, active: true, publicAvailable: true },
      { systemCode: "hole_faucet", displayName: "Отверстие", category: "production", unit: "pcs", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "joint_short", displayName: "Стык", category: "production", unit: "pcs", basePriceUsdCents: 4000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "edge_standard", displayName: "Кромка", category: "production", unit: "m", basePriceUsdCents: 2000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "manual_polish_small", displayName: "Ручная полировка", category: "production", unit: "service", basePriceUsdCents: 5000, calculationMode: "unit", active: true, publicAvailable: false },
      { systemCode: "install_countertop", displayName: "Монтаж", category: "installation", unit: "m", basePriceUsdCents: 2500, calculationMode: "unit", active: true, publicAvailable: true },
    ],
  };
}

function config(overrides = {}) {
  return {
    items: [{ productType: "countertop", shape: "straight", pieces: [{ lengthMm: 1000, widthMm: 600 }], straightCutM: 1, operations: [] }],
    operations: [],
    additionalLines: [],
    ...overrides,
  };
}

test("курс 3 и 4 индексирует ставку 5 USD", () => {
  const at3 = calculate(config(), pricebook(3));
  const at4 = calculate(config(), pricebook(4));
  assert.equal(at3.lines.find((x) => x.code === "cut_straight").amountBynCents, 1500);
  assert.equal(at4.lines.find((x) => x.code === "cut_straight").amountBynCents, 2000);
});

test("фигурный раскрой равен прямому раскрою × 1.30", () => {
  const result = calculate(config({ operations: [{ code: "cut_curved", quantity: 2 }] }), pricebook());
  assert.equal(result.lines.find((x) => x.code === "cut_curved").amountUsdCents, 1300);
});

test("прямая, Г- и П-образная формы суммируют площади деталей", () => {
  const straight = calculate(config(), pricebook());
  const l = calculate(config({ items: [{ shape: "l", pieces: [{ lengthMm: 1000, widthMm: 600 }, { lengthMm: 500, widthMm: 600 }], operations: [] }] }), pricebook());
  const u = calculate(config({ items: [{ shape: "u", pieces: [{ lengthMm: 1000, widthMm: 600 }, { lengthMm: 500, widthMm: 600 }, { lengthMm: 500, widthMm: 600 }], operations: [] }] }), pricebook());
  assert.equal(straight.metrics.areaM2, 0.6);
  assert.equal(l.metrics.areaM2, 0.9);
  assert.equal(u.metrics.areaM2, 1.2);
});

test("расход округляется вверх до 0.5 и допускает ручное значение", () => {
  assert.equal(roundSlabs(0.01), 0.5);
  assert.equal(roundSlabs(0.51), 1);
  const result = calculate(config({ manualSlabCount: 1.5 }), pricebook());
  assert.equal(result.material.slabCount, 1.5);
});

test("вырезы, стыки, кромки, монтаж и дополнительные строки входят в смету", () => {
  const result = calculate(config({
    operations: [
      { code: "hole_faucet", quantity: 1 },
      { code: "joint_short", quantity: 1 },
      { code: "edge_standard", quantity: 2 },
      { code: "install_countertop", quantity: 1 },
    ],
    additionalLines: [{ name: "Доставка", quantity: 1, unitPriceCents: 10000, currency: "BYN" }],
  }), pricebook());
  assert.equal(result.lines.length, 6);
  assert.equal(result.totals.additionalBynCents, 10000);
  assert.ok(Number.isFinite(result.totals.finalQuoteTotalCents));
});

test("резерв, публичный коэффициент и округление применяются последовательно", () => {
  const result = calculate(config(), pricebook());
  assert.equal(result.totals.reserveCents, Math.round(result.totals.technicalTotalCents * 0.1));
  assert.equal(result.totals.publicFromTotalCents % 1000, 0);
});

test("нулевые и неверные значения не создают NaN", () => {
  const result = calculate(config({ operations: [{ code: "hole_faucet", quantity: 0 }] }), pricebook());
  assert.ok(Object.values(result.totals).every(Number.isFinite));
  assert.throws(() => calculate(config({ items: [{ lengthMm: -1, widthMm: 600 }] }), pricebook()));
});

test("граница ручной полировки 1.00 м² выбирается вызывающей схемой однозначно", () => {
  const result = calculate(config({ operations: [{ code: "manual_polish_small", quantity: 1 }] }), pricebook());
  assert.equal(result.lines.find((x) => x.code === "manual_polish_small").amountUsdCents, 5000);
});

test("сохранённый снимок не меняется после изменения курса", () => {
  const saved = calculate(config(), pricebook(3));
  calculate(config(), pricebook(4));
  assert.equal(saved.exchangeRate, 3);
  assert.equal(saved.lines.find((x) => x.code === "cut_straight").amountBynCents, 1500);
});

test("публичный результат не раскрывает USD и внутренние коэффициенты", () => {
  const result = calculate(config(), pricebook(), "public");
  const json = JSON.stringify(result).toLowerCase();
  assert.equal(json.includes("usd"), false);
  assert.equal(json.includes("reserve"), false);
  assert.equal(result.currency, "BYN");
});
