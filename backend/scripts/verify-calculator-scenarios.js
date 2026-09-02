"use strict";

const assert = require("node:assert/strict");
const pool = require("../db");
const repository = require("../services/calculatorRepository");
const { calculate } = require("../services/calculatorService");

const materialId = process.argv[2] || "quartz-avant-7000";

function mainItem(shape, pieces, overrides = {}) {
  return {
    productType: "countertop",
    shape,
    pieces,
    automaticGeometry: true,
    polishedSides: 1,
    roundedCorners: 0,
    cornerRadiusMm: 50,
    edgeCode: "edge_standard",
    installation: true,
    backsplash: false,
    wallPanel: false,
    sinkType: "under",
    hob: true,
    tapHole: true,
    otherHoles: 0,
    operations: [],
    ...overrides,
  };
}

function extraItem(productType, lengthMm, widthMm, overrides = {}) {
  return {
    productType,
    shape: "straight",
    pieces: [{ lengthMm, widthMm }],
    automaticGeometry: true,
    polishedSides: 4,
    roundedCorners: 0,
    cornerRadiusMm: 50,
    edgeCode: "edge_standard",
    installation: true,
    backsplash: false,
    wallPanel: false,
    sinkType: "none",
    hob: false,
    tapHole: false,
    otherHoles: 0,
    operations: [],
    ...overrides,
  };
}

function configuration(items) {
  return {
    items,
    operations: [],
    additionalLines: [],
    manualSlabCount: null,
    manualMaterialPriceUsdCents: 0,
    materialMarkupBps: 0,
    additionalMaterialBynCents: 0,
    managerAdjustmentBynCents: 0,
  };
}

const scenarios = [
  {
    key: "straight",
    name: "Прямая 2900×600",
    expectedJoints: 0,
    configuration: configuration([
      mainItem("straight", [{ lengthMm: 2900, widthMm: 600 }]),
    ]),
  },
  {
    key: "l-with-bar",
    name: "Г-образная 2400×600 + 1600×650 и бар 1500×500",
    expectedJoints: 1,
    configuration: configuration([
      mainItem("l", [
        { lengthMm: 2400, widthMm: 600 },
        { lengthMm: 1600, widthMm: 650 },
      ], { polishedSides: 2, edgeCode: "edge_round" }),
      extraItem("bar", 1500, 500, { edgeCode: "edge_round" }),
    ]),
  },
  {
    key: "u-with-island",
    name: "П-образная 1800×600 + 2800×650 + 1700×600 и остров 1800×900 R100",
    expectedJoints: 2,
    configuration: configuration([
      mainItem("u", [
        { lengthMm: 1800, widthMm: 600 },
        { lengthMm: 2800, widthMm: 650 },
        { lengthMm: 1700, widthMm: 600 },
      ], { polishedSides: 3, edgeCode: "edge_reinforced", backsplash: true }),
      extraItem("island", 1800, 900, {
        edgeCode: "edge_reinforced",
        roundedCorners: 4,
        cornerRadiusMm: 100,
        hob: true,
      }),
    ]),
  },
];

async function main() {
  const pricebook = await repository.getPublishedPricebook({
    materialId,
    slabFormatCode: "normal",
    publicMode: true,
  });
  if (!pricebook) throw new Error(`Опубликованный прайс или материал ${materialId} не найден`);

  const results = scenarios.map((scenario) => {
    const internal = calculate(scenario.configuration, pricebook, "internal");
    const publicResult = calculate(scenario.configuration, pricebook, "public");
    assert.equal(internal.metrics.jointCount, scenario.expectedJoints);
    assert.ok(internal.metrics.areaM2 > 0);
    assert.ok(internal.metrics.processedEdgeM > 0);
    assert.ok(publicResult.publicFromTotal > 0);
    return {
      key: scenario.key,
      name: scenario.name,
      material: internal.material.title,
      exchangeRate: internal.exchangeRate,
      areaM2: internal.metrics.areaM2,
      areaWithWasteM2: internal.metrics.areaWithWasteM2,
      slabAreaM2: internal.metrics.slabAreaM2,
      straightCutM: internal.metrics.straightCutM,
      curvedCutM: internal.metrics.curvedCutM,
      processedEdgeM: internal.metrics.processedEdgeM,
      joints: internal.metrics.jointCount,
      slabs: internal.material.slabCount,
      materialMarkupPercent: internal.material.markupBps / 100,
      materialUsd: internal.material.materialUsdCents / 100,
      materialByn: internal.totals.materialBynCents / 100,
      productionByn: internal.totals.productionBynCents / 100,
      lines: internal.lines.map((line) => ({
        code: line.code,
        name: line.name,
        quantity: line.quantity,
        amountByn: line.amountBynCents / 100,
      })),
      technicalByn: internal.totals.technicalTotalCents / 100,
      reserveByn: internal.totals.reserveCents / 100,
      managerByn: internal.totals.recommendedManagerTotalCents / 100,
      publicFromByn: publicResult.publicFromTotal,
    };
  });

  console.log(JSON.stringify({
    success: true,
    pricebookVersion: pricebook.version,
    materialId,
    scenarios: results,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
