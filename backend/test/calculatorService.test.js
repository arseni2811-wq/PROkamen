const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, itemGeometry, roundSlabs } = require("../services/calculatorService");

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
      { systemCode: "hole_socket", displayName: "Отверстие под розетку", category: "cutout", unit: "pcs", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "hole_dispenser", displayName: "Отверстие под дозатор", category: "cutout", unit: "pcs", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "cutout_round", displayName: "Круглый вырез", category: "cutout", unit: "pcs", basePriceUsdCents: 7000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "joint_short", displayName: "Стык", category: "production", unit: "pcs", basePriceUsdCents: 4000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "joint_long", displayName: "Длинный стык", category: "production", unit: "pcs", basePriceUsdCents: 8000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "edge_standard", displayName: "Кромка", category: "production", unit: "m", basePriceUsdCents: 2000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "edge_round", displayName: "Овальная или круглая кромка", category: "production", unit: "m", basePriceUsdCents: 3000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "polish_20", displayName: "Полировка 20 мм", category: "production", unit: "m", basePriceUsdCents: 2000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "polish_40", displayName: "Полировка 40 мм", category: "production", unit: "m", basePriceUsdCents: 4000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "cutout_hob", displayName: "Вырез под варочную панель", category: "cutout", unit: "pcs", basePriceUsdCents: 4000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "cutout_sink_under", displayName: "Вырез под мойку снизу", category: "cutout", unit: "pcs", basePriceUsdCents: 5000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "backsplash_make", displayName: "Изготовление бортика", category: "production", unit: "m", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "backsplash", displayName: "Пристенный бортик", category: "additional", unit: "m", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "install_plinth", displayName: "Монтаж бортика", category: "installation", unit: "m", basePriceUsdCents: 500, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "install_sink", displayName: "Вклейка мойки", category: "installation", unit: "pcs", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "manual_polish_small", displayName: "Ручная полировка", category: "production", unit: "service", basePriceUsdCents: 5000, calculationMode: "unit", active: true, publicAvailable: false },
      { systemCode: "manual_polish_large", displayName: "Ручная полировка более 1 м²", category: "production", unit: "service", basePriceUsdCents: 8000, calculationMode: "unit", active: true, publicAvailable: false },
      { systemCode: "install_countertop", displayName: "Монтаж", category: "installation", unit: "m", basePriceUsdCents: 2500, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "install_sill", displayName: "Монтаж подоконника", category: "installation", unit: "m", basePriceUsdCents: 2500, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "wall_panel", displayName: "Скинали", category: "production", unit: "m", basePriceUsdCents: 2000, calculationMode: "unit", active: true, publicAvailable: true },
      { systemCode: "install_wall_panel", displayName: "Монтаж скинали", category: "installation", unit: "m", basePriceUsdCents: 1000, calculationMode: "unit", active: true, publicAvailable: true },
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

test("автоматическая геометрия добавляет 0, 1 и 2 стыка по форме", () => {
  const makeItem = (shape, pieces) => ({
    productType: "countertop",
    shape,
    pieces,
    automaticGeometry: true,
    polishedSides: 1,
    edgeCode: "edge_standard",
    operations: [],
  });
  const straight = calculate(config({ items: [makeItem("straight", [{ lengthMm: 1000, widthMm: 600 }])] }), pricebook());
  const l = calculate(config({ items: [makeItem("l", [{ lengthMm: 1000, widthMm: 600 }, { lengthMm: 500, widthMm: 600 }])] }), pricebook());
  const u = calculate(config({ items: [makeItem("u", [{ lengthMm: 1000, widthMm: 600 }, { lengthMm: 500, widthMm: 600 }, { lengthMm: 500, widthMm: 600 }])] }), pricebook());
  assert.equal(straight.lines.find((line) => line.code === "joint_short"), undefined);
  assert.equal(l.lines.find((line) => line.code === "joint_short").quantity, 1);
  assert.equal(u.lines.find((line) => line.code === "joint_short").quantity, 2);
});

test("столешница получает кромку только по лицевой длине без боковых торцов", () => {
  const edgeLength = (polishedSides) => calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 2000, widthMm: 600 }],
      automaticGeometry: true,
      polishedSides,
      edgeCode: "edge_standard",
      operations: [],
    }],
  }), pricebook()).lines.find((line) => line.code === "edge_standard").quantity;
  assert.equal(edgeLength(1), 2);
  assert.equal(edgeLength(2), 2);
  assert.equal(edgeLength(3), 2);
});

test("раскрой столешниц и подоконников считает полный периметр каждой детали", () => {
  const straight = itemGeometry({
    productType: "countertop",
    shape: "straight",
    pieces: [{ lengthMm: 2000, widthMm: 600 }],
  });
  const l = itemGeometry({
    productType: "countertop",
    shape: "l",
    pieces: [
      { lengthMm: 2000, widthMm: 600 },
      { lengthMm: 1500, widthMm: 600 },
    ],
  });
  const uSill = itemGeometry({
    productType: "windowsill",
    shape: "u",
    pieces: [
      { lengthMm: 850, widthMm: 300 },
      { lengthMm: 1600, widthMm: 300 },
      { lengthMm: 850, widthMm: 300 },
    ],
  });
  const straightSill = itemGeometry({
    productType: "windowsill",
    shape: "straight",
    pieces: [{ lengthMm: 1500, widthMm: 300 }],
  });
  assert.equal(straight.straightCutM, 5.2);
  assert.equal(l.straightCutM, 9.4);
  assert.equal(uSill.straightCutM, 8.4);
  assert.equal(straightSill.straightCutM, 3.6);
  assert.equal(straightSill.processedEdgeM, 1.5);
});

test("стык длинной столешницы не увеличивает раскрой и не создаёт отдельную полировку", () => {
  const geometry = itemGeometry({
    productType: "countertop",
    shape: "straight",
    pieces: [{ lengthMm: 4200, widthMm: 600 }],
  }, 3050);
  assert.equal(geometry.straightCutM, 9.6);
  assert.equal(geometry.processedEdgeM, 4.2);
  assert.equal(geometry.lengthSplitCount, 1);
  assert.equal(geometry.jointPolishM, 0.6);
  assert.equal(geometry.jointCount, 1);

  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 4200, widthMm: 600 }],
      automaticGeometry: true,
      polishedSides: 1,
      edgeCode: "edge_standard",
      operations: [],
    }],
  }), pricebook());
  const quantities = Object.fromEntries(result.lines.map((line) => [line.code, line.quantity]));
  assert.equal(quantities.cut_straight, 9.6);
  assert.equal(quantities.edge_standard, 4.2);
  assert.equal(quantities.joint_short, 1);
  assert.equal(quantities.polish_20, undefined);
  assert.equal(quantities.polish_40, undefined);
});

test("каждое следующее превышение длины слэба добавляет ещё один комплект стыковки", () => {
  const geometry = itemGeometry({
    productType: "windowsill",
    shape: "straight",
    pieces: [{ lengthMm: 7000, widthMm: 600 }],
  }, 3050);
  assert.equal(geometry.straightCutM, 15.2);
  assert.equal(geometry.lengthSplitCount, 2);
  assert.equal(geometry.jointPolishM, 1.2);
  assert.equal(geometry.jointCount, 2);
});

test("остров рассчитывает площадь и кромку по полному периметру", () => {
  const geometry = itemGeometry({
    productType: "island",
    shape: "straight",
    pieces: [{ lengthMm: 1800, widthMm: 900 }],
    polishedSides: 4,
  });
  assert.equal(geometry.areaM2, 1.62);
  assert.equal(geometry.straightCutM, 5.4);
  assert.equal(geometry.curvedCutM, 0);
  assert.equal(geometry.processedEdgeM, 5.4);
  assert.equal(geometry.installationM, 1.8);
});

test("барная стойка получает полукруглый торец без ручных операций", () => {
  const result = calculate(config({
    items: [{
      ...config().items[0],
      productType: "bar",
      pieces: [{ lengthMm: 1800, widthMm: 500 }],
      automaticGeometry: true,
      polishedSides: 4,
      edgeCode: "edge_standard",
    }],
  }), pricebook());
  assert.equal(result.metrics.areaM2, 0.873175);
  assert.equal(result.metrics.straightCutM, 3.6);
  assert.equal(result.metrics.curvedCutM, 0.785);
  assert.equal(result.metrics.processedEdgeM, 4.385);
  assert.equal(result.lines.find((line) => line.code === "cut_curved").quantity, 0.785);
  assert.equal(result.lines.find((line) => line.code === "edge_standard").quantity, 4.385);
});

test("барная стойка отклоняет физически невозможный полукруглый торец", () => {
  assert.throws(() => itemGeometry({
    productType: "bar",
    shape: "straight",
    pieces: [{ lengthMm: 300, widthMm: 800 }],
    polishedSides: 4,
  }), /половины её глубины/);
});

test("четыре радиусных угла острова уменьшают площадь и заменяют прямые резы дугами", () => {
  const geometry = itemGeometry({
    productType: "island",
    shape: "straight",
    pieces: [{ lengthMm: 1800, widthMm: 900 }],
    polishedSides: 4,
    roundedCorners: 4,
    cornerRadiusMm: 50,
  });
  assert.equal(geometry.areaM2, 1.617854);
  assert.equal(geometry.straightCutM, 5);
  assert.equal(geometry.curvedCutM, 0.314);
  assert.equal(geometry.processedEdgeM, 5.314);
});

test("мойка, панель, бортик и монтаж создают производственные строки автоматически", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 2000, widthMm: 600 }],
      automaticGeometry: true,
      polishedSides: 1,
      edgeCode: "edge_standard",
      sinkType: "under",
      hob: true,
      tapHole: true,
      backsplash: true,
      installation: true,
      operations: [],
    }],
  }), pricebook());
  const quantities = Object.fromEntries(result.lines.map((line) => [line.code, line.quantity]));
  assert.equal(quantities.cutout_sink_under, 1);
  assert.equal(quantities.cutout_hob, 1);
  assert.equal(quantities.hole_faucet, 1);
  assert.equal(quantities.backsplash_make, 2);
  assert.equal(quantities.backsplash, undefined);
  assert.equal(quantities.install_countertop, 2);
  assert.equal(quantities.install_plinth, 2);
});

test("расход округляется вверх до 0.5 и допускает ручное значение", () => {
  assert.equal(roundSlabs(0.01), 0.5);
  assert.equal(roundSlabs(0.5), 0.5);
  assert.equal(roundSlabs(0.5001), 1);
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

test("ровно 1.00 м² использует малый тариф ручной полировки, свыше — большой", () => {
  const atBoundary = calculate(config({
    items: [{ pieces: [{ lengthMm: 1000, widthMm: 1000 }], operations: [] }],
    operations: [{ code: "manual_polish_area", quantity: 1 }],
  }), pricebook());
  const aboveBoundary = calculate(config({
    items: [{ pieces: [{ lengthMm: 1001, widthMm: 1000 }], operations: [] }],
    operations: [{ code: "manual_polish_area", quantity: 1 }],
  }), pricebook());
  assert.equal(atBoundary.lines.find((x) => x.code === "manual_polish_small").amountUsdCents, 5000);
  assert.equal(aboveBoundary.lines.find((x) => x.code === "manual_polish_large").amountUsdCents, 8000);
});

test("ручная наценка и дополнительная стоимость материала входят в техническую сумму", () => {
  const result = calculate(config({
    materialMarkupBps: 2000,
    additionalMaterialBynCents: 12000,
  }), pricebook());
  assert.equal(result.material.markupBps, 2000);
  assert.equal(result.material.additionalMaterialBynCents, 12000);
  assert.ok(result.totals.materialBynCents >= 12000);
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
  assert.equal(result.material.slabCount, 0.5);
  assert.equal(result.material.slabFormat.code, "normal");
  assert.equal(
    result.totals.materialBynCents + result.totals.worksBynCents,
    result.publicFromTotalCents,
  );
});

test("радиусный бортик сохраняется без выдуманной публичной стоимости", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 2000, widthMm: 600 }],
      automaticGeometry: true,
      polishedSides: 1,
      edgeCode: "edge_standard",
      backsplashType: "coved",
      backsplashLengthM: 2,
      operations: [],
    }],
  }), pricebook());
  assert.equal(result.lines.some((line) => line.code === "backsplash_make"), false);
  assert.equal(result.lines.some((line) => line.code === "backsplash"), false);
});

test("розетки, дозатор и круглые вырезы считаются отдельными тарифами", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 2000, widthMm: 600 }],
      automaticGeometry: true,
      polishedSides: 1,
      edgeCode: "edge_standard",
      socketHoles: 2,
      dispenserHoles: 1,
      roundCutouts: 1,
      operations: [],
    }],
  }), pricebook());
  const quantities = Object.fromEntries(result.lines.map((line) => [line.code, line.quantity]));
  assert.equal(quantities.hole_socket, 2);
  assert.equal(quantities.hole_dispenser, 1);
  assert.equal(quantities.cutout_round, 1);
});

test("эркерный подоконник имеет две стыковки и собственную геометрию", () => {
  const geometry = itemGeometry({
    productType: "windowsill",
    shape: "u",
    pieces: [
      { lengthMm: 850, widthMm: 300 },
      { lengthMm: 1600, widthMm: 300 },
      { lengthMm: 850, widthMm: 300 },
    ],
    polishedSides: 1,
  });
  assert.equal(geometry.areaM2, 0.99);
  assert.equal(geometry.jointCount, 2);
  assert.equal(geometry.backLengthM, 3.3);
  assert.equal(geometry.processedEdgeM, 3.3);
});

test("скинали по тыльному периметру получает автоматическую длину", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "l",
      pieces: [
        { lengthMm: 2000, widthMm: 600 },
        { lengthMm: 1500, widthMm: 600 },
      ],
      automaticGeometry: true,
      polishedSides: 1,
      wallPanel: true,
      wallPanelAutoLength: true,
      wallPanelLengthM: 1,
      operations: [],
    }],
  }), pricebook());
  assert.equal(result.lines.find((line) => line.code === "wall_panel").quantity, 3.5);
});

test("прямоугольный, круглый и овальный столы считают площадь и полный периметр", () => {
  const rectangle = itemGeometry({
    productType: "table",
    tableShape: "rectangle",
    shape: "straight",
    pieces: [{ lengthMm: 1600, widthMm: 900 }],
    polishedSides: 4,
  });
  const round = itemGeometry({
    productType: "table",
    tableShape: "round",
    shape: "straight",
    pieces: [{ lengthMm: 1100, widthMm: 1100 }],
    polishedSides: 4,
  });
  const oval = itemGeometry({
    productType: "table",
    tableShape: "oval",
    shape: "straight",
    pieces: [{ lengthMm: 1600, widthMm: 900 }],
    polishedSides: 4,
  });
  assert.equal(rectangle.areaM2, 1.44);
  assert.equal(rectangle.processedEdgeM, 5);
  assert.equal(round.straightCutM, 0);
  assert.equal(round.curvedCutM, 3.456);
  assert.equal(round.processedEdgeM, 3.456);
  assert.equal(oval.straightCutM, 0);
  assert.ok(oval.areaM2 > 1.13 && oval.areaM2 < 1.14);
  assert.ok(oval.processedEdgeM > 4 && oval.processedEdgeM < 4.1);
});

test("уточнение сторон добавляет только выбранные торцы к лицевой кромке", () => {
  const geometry = itemGeometry({
    productType: "countertop",
    shape: "straight",
    pieces: [{ lengthMm: 2000, widthMm: 600 }],
    edgeSides: { front: true, left: true, right: false },
    wallSides: { back: true, left: false, right: true },
  });
  assert.equal(geometry.processedEdgeM, 2.6);
  assert.equal(geometry.backLengthM, 2.6);
});

test("лицевая кромка столешницы учитывает только выбранные стороны", () => {
  const geometry = (edgeSides) => itemGeometry({
    productType: "countertop",
    shape: "straight",
    pieces: [{ lengthMm: 4200, widthMm: 600 }],
    edgeSides,
  });
  assert.equal(geometry({ front: true, left: false, right: false }).processedEdgeM, 4.2);
  assert.equal(geometry({ front: true, left: true, right: false }).processedEdgeM, 4.8);
  assert.equal(geometry({ front: true, left: true, right: true }).processedEdgeM, 5.4);
});

test("профили столешницы выбирают подтверждённую тарифную группу", () => {
  const expectedCodes = {
    model_1: "edge_standard",
    model_2: "edge_round",
    model_3: "edge_round",
    model_4: "edge_standard",
    model_5: "edge_standard",
    model_6: "edge_standard",
    model_7: "edge_standard",
  };
  for (const [edgeProfileModel, expectedCode] of Object.entries(expectedCodes)) {
    const result = calculate(config({
      items: [{
        productType: "countertop",
        shape: "straight",
        pieces: [{ lengthMm: 2000, widthMm: 600 }],
        automaticGeometry: true,
        edgeCode: "edge_standard",
        edgeProfileModel,
        operations: [],
      }],
    }), pricebook());
    assert.equal(result.lines.find((line) => line.code.startsWith("edge_"))?.code, expectedCode);
  }
  assert.equal(Object.values(expectedCodes).includes("edge_reinforced"), false);
});

test("эталон 4200×600 даёт 314 USD услуг без монтажа и полировки стыка", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 4200, widthMm: 600 }],
      automaticGeometry: true,
      edgeCode: "edge_standard",
      edgeProfileModel: "model_2",
      edgeSides: { front: true, left: false, right: false },
      sinkType: "under",
      hob: true,
      tapHole: true,
      installation: false,
      operations: [],
    }],
  }), pricebook());
  const lines = Object.fromEntries(result.lines.map((line) => [line.code, line]));
  assert.equal(lines.cut_straight.quantity, 9.6);
  assert.equal(lines.cut_straight.amountUsdCents, 4800);
  assert.equal(lines.edge_round.quantity, 4.2);
  assert.equal(lines.edge_round.amountUsdCents, 12600);
  assert.equal(lines.joint_short.quantity, 1);
  assert.equal(lines.joint_short.amountUsdCents, 4000);
  assert.equal(lines.cutout_sink_under.amountUsdCents, 5000);
  assert.equal(lines.cutout_hob.amountUsdCents, 4000);
  assert.equal(lines.hole_faucet.amountUsdCents, 1000);
  assert.equal(lines.polish_20, undefined);
  assert.equal(lines.polish_40, undefined);
  assert.equal(lines.install_countertop, undefined);
  assert.equal(result.lines.reduce((sum, line) => sum + line.amountUsdCents, 0), 31400);
});

test("столешница не длиннее слэба не получает стык", () => {
  const geometry = itemGeometry({
    productType: "countertop",
    shape: "straight",
    pieces: [{ lengthMm: 3050, widthMm: 600 }],
  }, 3050);
  assert.equal(geometry.jointCount, 0);
  assert.equal(geometry.jointPolishM, 0);
});

test("скинали добавляет площадь материала, высоту и раскрой панели", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 2000, widthMm: 600 }],
      automaticGeometry: true,
      edgeCode: "edge_standard",
      wallPanel: true,
      wallPanelAutoLength: true,
      wallPanelHeightMm: 600,
      operations: [],
    }],
  }), pricebook());
  assert.equal(result.metrics.items[0].productAreaM2, 1.2);
  assert.equal(result.metrics.items[0].wallPanelAreaM2, 1.2);
  assert.equal(result.metrics.areaM2, 2.4);
  assert.equal(result.metrics.items[0].straightCutM, 7.8);
});

test("раскладка делит длинную деталь по слэбу и отмечает продолжение", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 4200, widthMm: 600 }],
      automaticGeometry: true,
      edgeCode: "edge_standard",
      operations: [],
    }],
  }), pricebook());
  const parts = result.metrics.slabLayout.slabs.flatMap((slab) => slab.parts);
  assert.equal(parts.length, 2);
  assert.equal(parts.filter((part) => part.continuation).length, 1);
  assert.ok(parts.every((part) => part.lengthMm <= 3050 && part.widthMm <= 1440));
});

test("публичный ответ содержит только агрегаты материала и работ", () => {
  const result = calculate(config({
    items: [{
      productType: "countertop",
      shape: "straight",
      pieces: [{ lengthMm: 2000, widthMm: 600 }],
      automaticGeometry: true,
      edgeCode: "edge_standard",
      tapHole: true,
      operations: [],
    }],
  }), pricebook(), "public");
  assert.equal(Object.hasOwn(result, "lines"), false);
  assert.equal(result.totals.materialBynCents + result.totals.worksBynCents, result.publicFromTotalCents);
  assert.equal(JSON.stringify(result).includes("basePriceUsdCents"), false);
  assert.equal(JSON.stringify(result).includes("hole_faucet"), false);
});
