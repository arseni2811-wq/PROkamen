const test = require("node:test");
const assert = require("node:assert/strict");
const { getRequiredFractionPrices } = require("../services/calculatorRepository");

test("runtime variant prices require exactly one active FULL and HALF", () => {
  assert.deepEqual(getRequiredFractionPrices([
    { quantity_fraction: 1, calculator_amount_usd_cents: 610 },
    { quantity_fraction: 0.5, calculator_amount_usd_cents: 315 },
  ]), { "1": 610, "0.5": 315 });
  assert.throws(() => getRequiredFractionPrices([{ quantity_fraction: 1, calculator_amount_usd_cents: 610 }]), /половины/);
  assert.throws(() => getRequiredFractionPrices([{ quantity_fraction: 0.5, calculator_amount_usd_cents: 315 }]), /полного/);
  assert.throws(() => getRequiredFractionPrices([
    { quantity_fraction: 1, calculator_amount_usd_cents: 610 },
    { quantity_fraction: 1, calculator_amount_usd_cents: 620 },
    { quantity_fraction: 0.5, calculator_amount_usd_cents: 315 },
  ]), /несколько активных/);
});
