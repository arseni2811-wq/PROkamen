const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublicCalculatorPdf } = require("../services/publicCalculatorPdf");

test("публичный PDF формируется из BYN-снимка", async () => {
  const calculation = {
    publicFromTotalCents: 123400,
    metrics: { areaM2: 1.74 },
    material: {
      title: "Тестовый кварц",
      manufacturer: "ПРО Камень",
      slabCount: 0.5,
      slabFormat: { name: "Normal", code: "normal", lengthMm: 3050, widthMm: 1440, thicknessMm: 20 },
    },
    totals: { materialBynCents: 100000, worksBynCents: 23400 },
    lines: [{ name: "Прямой раскрой", quantity: 2, unit: "m", amountBynCents: 23400 }],
  };
  const configuration = {
    items: [{ productType: "countertop", shape: "straight", pieces: [{ lengthMm: 2900, widthMm: 600 }] }],
  };
  const buffer = await createPublicCalculatorPdf(calculation, configuration);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(buffer.length > 1000);
});
