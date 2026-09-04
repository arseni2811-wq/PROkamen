const test = require("node:test");
const assert = require("node:assert/strict");
const { getRequiredFractionPrices, variantAvailability } = require("../services/calculatorRepository");

test("runtime variant prices require one complete currency pair with a direct BYN rate", () => {
  const eurRates = { EUR: { bynPerUnitScaled: 36000, rateDate: "2026-09-04" } };
  assert.deepEqual(getRequiredFractionPrices([
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "EUR" },
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "EUR" },
  ], eurRates), { currency: "EUR", fullMinor: 61000, halfMinor: 31500, exchangeRateToBynScaled: 36000, exchangeRateDate: "2026-09-04" });
  assert.throws(() => getRequiredFractionPrices([{ quantity_fraction: 1, source_amount_minor: 61000, source_currency: "USD" }], { USD: { bynPerUnitScaled: 32000 } }));
  assert.throws(() => getRequiredFractionPrices([
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "USD" },
    { quantity_fraction: 1, source_amount_minor: 62000, source_currency: "USD" },
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "USD" },
  ], { USD: { bynPerUnitScaled: 32000 } }));
  assert.throws(() => getRequiredFractionPrices([
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "USD" },
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "EUR" },
  ], { USD: { bynPerUnitScaled: 32000 }, EUR: { bynPerUnitScaled: 36000 } }));
});

test("variant availability reports structural price problems before a missing exchange rate", () => {
  const usdRates = { USD: { bynPerUnitScaled: 32000 } };
  const eurPricePair = [
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "EUR" },
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "EUR" },
  ];
  assert.equal(variantAvailability([
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "USD" },
  ], usdRates, { is_active: true }).code, "MISSING_FULL");
  assert.equal(variantAvailability([
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "EUR" },
  ], {}, { is_active: true }).code, "MISSING_HALF");
  assert.equal(variantAvailability(eurPricePair, {}, { is_active: true }).code, "MISSING_EXCHANGE_RATE");
  assert.equal(variantAvailability([
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "USD" },
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "EUR" },
  ], { ...usdRates, EUR: { bynPerUnitScaled: 36500 } }, { is_active: true }).code, "MIXED_CURRENCIES");
  assert.equal(variantAvailability([
    { quantity_fraction: 1, source_amount_minor: 61000, source_currency: "USD" },
    { quantity_fraction: 1, source_amount_minor: 62000, source_currency: "USD" },
    { quantity_fraction: 0.5, source_amount_minor: 31500, source_currency: "USD" },
  ], usdRates, { is_active: true }).code, "AMBIGUOUS_PRICES");
  assert.equal(variantAvailability(eurPricePair, {}, { is_active: true, is_discontinued: true }).ready, false);
  assert.equal(variantAvailability(eurPricePair, { EUR: { bynPerUnitScaled: 36500 } }, { is_active: true, is_discontinued: true }).ready, true);
});
