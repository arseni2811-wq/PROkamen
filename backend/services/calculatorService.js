"use strict";

const SNAPSHOT_SCHEMA_VERSION = 2;
const BPS = 10000;

function asNonNegativeInteger(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${field} должно быть неотрицательным числом`);
  }
  return Math.round(number);
}

function asNonNegativeNumber(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${field} должно быть неотрицательным числом`);
  }
  return number;
}

function multiplyCents(unitCents, quantity) {
  return Math.round(asNonNegativeInteger(unitCents, "Цена") * quantity);
}

function usdToBynCents(usdCents, exchangeRateScaled) {
  return Math.round(
    (asNonNegativeInteger(usdCents, "Сумма USD") *
      asNonNegativeInteger(exchangeRateScaled, "Курс")) /
      BPS,
  );
}

function roundUpCents(value, stepCents) {
  const step = Math.max(1, asNonNegativeInteger(stepCents, "Шаг округления"));
  return Math.ceil(asNonNegativeInteger(value, "Сумма") / step) * step;
}

function roundSlabs(value) {
  return Math.ceil(asNonNegativeNumber(value, "Расход слэбов") * 2) / 2;
}

function normalizePieces(configuration) {
  const items = Array.isArray(configuration.items) ? configuration.items : [];
  if (items.length === 0) throw new TypeError("Добавьте хотя бы одно изделие");

  return items.map((item, itemIndex) => {
    const rawPieces = Array.isArray(item.pieces) && item.pieces.length
      ? item.pieces
      : [{ lengthMm: item.lengthMm, widthMm: item.widthMm }];
    const pieces = rawPieces.map((piece, pieceIndex) => {
      const lengthMm = asNonNegativeNumber(
        piece.lengthMm,
        `Длина детали ${itemIndex + 1}.${pieceIndex + 1}`,
      );
      const widthMm = asNonNegativeNumber(
        piece.widthMm,
        `Ширина детали ${itemIndex + 1}.${pieceIndex + 1}`,
      );
      if (lengthMm <= 0 || widthMm <= 0) {
        throw new TypeError("Размеры каждой детали должны быть больше нуля");
      }
      return { lengthMm, widthMm };
    });
    return {
      productType: item.productType || "countertop",
      shape: item.shape || "straight",
      pieces,
      operations: Array.isArray(item.operations) ? item.operations : [],
      processedEdgeM: asNonNegativeNumber(item.processedEdgeM, "Длина кромки"),
      straightCutM:
        item.straightCutM === undefined
          ? pieces.reduce(
              (sum, piece) => sum + (piece.lengthMm + piece.widthMm) * 2 / 1000,
              0,
            )
          : asNonNegativeNumber(item.straightCutM, "Прямой раскрой"),
    };
  });
}

function calculateRateLine(rate, quantity) {
  const normalizedQuantity = asNonNegativeNumber(quantity, rate.systemCode);
  let usdCents = 0;
  if (rate.calculationMode === "manual") {
    usdCents = asNonNegativeInteger(rate.manualUsdCents, rate.systemCode);
  } else if (rate.calculationMode === "dependent") {
    usdCents = multiplyCents(
      rate.dependentBaseUsdCents,
      normalizedQuantity * Number(rate.percentBps || BPS) / BPS,
    );
  } else {
    usdCents = multiplyCents(rate.basePriceUsdCents, normalizedQuantity);
  }
  return {
    code: rate.systemCode,
    name: rate.displayName,
    category: rate.category,
    unit: rate.unit,
    quantity: normalizedQuantity,
    basePriceUsdCents: asNonNegativeInteger(
      rate.basePriceUsdCents ?? rate.dependentBaseUsdCents,
      rate.systemCode,
    ),
    amountUsdCents: usdCents,
  };
}

function calculateMaterial(material, slabCount, areaM2, markupBps, manualUsdCents) {
  let baseUsdCents;
  switch (material.priceUnit) {
    case "slab":
      baseUsdCents = multiplyCents(material.basePriceUsdCents, slabCount);
      break;
    case "half_slab":
      baseUsdCents = multiplyCents(material.basePriceUsdCents, slabCount * 2);
      break;
    case "sqm":
      baseUsdCents = multiplyCents(material.basePriceUsdCents, areaM2);
      break;
    case "manual":
      baseUsdCents = asNonNegativeInteger(manualUsdCents, "Ручная цена материала");
      break;
    default:
      throw new TypeError("Неизвестная единица цены материала");
  }
  const effectiveMarkupBps = Math.max(
    asNonNegativeInteger(material.markupBps, "Наценка материала"),
    asNonNegativeInteger(markupBps, "Минимальная наценка"),
  );
  return {
    baseUsdCents,
    markupBps: effectiveMarkupBps,
    totalUsdCents: Math.round(baseUsdCents * (BPS + effectiveMarkupBps) / BPS),
  };
}

function calculate(configuration, pricebook, mode = "internal") {
  if (!pricebook || !pricebook.material || !pricebook.slabFormat) {
    throw new TypeError("Не переданы материал и формат слэба");
  }
  const piecesByItem = normalizePieces(configuration);
  const allPieces = piecesByItem.flatMap((item) => item.pieces);
  const areaM2 = Math.round(
    allPieces.reduce(
      (sum, piece) => sum + piece.lengthMm * piece.widthMm / 1000000,
      0,
    ) * 1000000,
  ) / 1000000;
  const wasteBps = asNonNegativeInteger(pricebook.settings.wasteBps, "Отходы");
  const areaWithWasteM2 = areaM2 * (BPS + wasteBps) / BPS;
  const slabAreaM2 =
    asNonNegativeNumber(pricebook.slabFormat.lengthMm, "Длина слэба") *
    asNonNegativeNumber(pricebook.slabFormat.widthMm, "Ширина слэба") /
    1000000;
  if (slabAreaM2 <= 0) throw new TypeError("Некорректный формат слэба");
  const automaticSlabCount = roundSlabs(areaWithWasteM2 / slabAreaM2);
  const slabCount = configuration.manualSlabCount === null ||
    configuration.manualSlabCount === undefined
    ? automaticSlabCount
    : roundSlabs(configuration.manualSlabCount);

  const material = calculateMaterial(
    pricebook.material,
    slabCount,
    areaWithWasteM2,
    pricebook.settings.minimumMaterialMarkupBps,
    configuration.manualMaterialPriceUsdCents,
  );

  const rates = new Map(pricebook.rates.map((rate) => [rate.systemCode, rate]));
  const quantities = new Map();
  for (const item of piecesByItem) {
    quantities.set(
      "cut_straight",
      (quantities.get("cut_straight") || 0) + item.straightCutM,
    );
    for (const operation of item.operations) {
      quantities.set(
        operation.code,
        (quantities.get(operation.code) || 0) +
          asNonNegativeNumber(operation.quantity, operation.code),
      );
    }
  }
  for (const operation of configuration.operations || []) {
    quantities.set(
      operation.code,
      (quantities.get(operation.code) || 0) +
        asNonNegativeNumber(operation.quantity, operation.code),
    );
  }

  const lines = [];
  for (const [code, quantity] of quantities) {
    const rate = rates.get(code);
    if (!rate || !rate.active) throw new TypeError(`Тариф ${code} недоступен`);
    if (mode === "public" && !rate.publicAvailable) {
      throw new TypeError(`Тариф ${code} недоступен в публичном расчёте`);
    }
    const effectiveRate = rate.calculationMode === "dependent"
      ? {
          ...rate,
          dependentBaseUsdCents: rates.get(rate.dependentCode)?.basePriceUsdCents,
        }
      : rate;
    lines.push(calculateRateLine(effectiveRate, quantity));
  }

  for (const manual of configuration.additionalLines || []) {
    const quantity = asNonNegativeNumber(manual.quantity, "Количество доп. строки");
    const amountBynCents = manual.currency === "USD"
      ? usdToBynCents(multiplyCents(manual.unitPriceCents, quantity), pricebook.exchangeRateScaled)
      : multiplyCents(manual.unitPriceCents, quantity);
    lines.push({
      code: "manual",
      name: String(manual.name || "Дополнительная услуга").slice(0, 160),
      category: manual.category || "additional",
      unit: manual.unit || "услуга",
      quantity,
      basePriceUsdCents: manual.currency === "USD" ? manual.unitPriceCents : null,
      amountUsdCents: manual.currency === "USD"
        ? multiplyCents(manual.unitPriceCents, quantity)
        : 0,
      amountBynCents,
      comment: String(manual.comment || "").slice(0, 500),
      manual: true,
    });
  }

  const productionUsdCents = lines.reduce(
    (sum, line) => sum + asNonNegativeInteger(line.amountUsdCents, line.code),
    0,
  );
  const manualBynCents = lines.reduce(
    (sum, line) => sum + asNonNegativeInteger(line.amountBynCents, line.code),
    0,
  );
  const materialBynCents = usdToBynCents(material.totalUsdCents, pricebook.exchangeRateScaled);
  const productionBynCents = usdToBynCents(productionUsdCents, pricebook.exchangeRateScaled);
  const technicalTotalCents = materialBynCents + productionBynCents + manualBynCents;
  const reserveCents = Math.round(
    technicalTotalCents * asNonNegativeInteger(pricebook.settings.reserveBps, "Резерв") / BPS,
  );
  const recommendedManagerTotalCents = Math.max(
    technicalTotalCents + reserveCents,
    asNonNegativeInteger(pricebook.settings.minimumOrderBynCents, "Минимальный заказ"),
  );
  const adjustmentCents = Math.round(Number(configuration.managerAdjustmentBynCents || 0));
  if (!Number.isFinite(adjustmentCents)) throw new TypeError("Некорректная корректировка");
  const finalQuoteTotalCents = Math.max(0, recommendedManagerTotalCents + adjustmentCents);
  const publicFromTotalCents = roundUpCents(
    Math.round(
      recommendedManagerTotalCents *
        asNonNegativeInteger(pricebook.settings.publicFactorBps, "Публичный коэффициент") /
        BPS,
    ),
    pricebook.settings.roundingStepBynCents,
  );

  const result = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    pricebookVersion: pricebook.version,
    calculatedAt: new Date().toISOString(),
    exchangeRate: Number(pricebook.exchangeRateScaled) / BPS,
    exchangeRateScaled: pricebook.exchangeRateScaled,
    configuration,
    material: {
      id: pricebook.material.id,
      category: pricebook.material.category,
      title: pricebook.material.title,
      slabFormat: pricebook.slabFormat,
      slabCount,
      automaticSlabCount,
      basePriceUsdCents: pricebook.material.basePriceUsdCents,
      markupBps: material.markupBps,
      materialUsdCents: material.totalUsdCents,
      materialBynCents,
    },
    metrics: { areaM2, areaWithWasteM2, slabAreaM2 },
    lines: lines.map((line) => ({
      ...line,
      amountBynCents:
        line.amountBynCents ?? usdToBynCents(line.amountUsdCents, pricebook.exchangeRateScaled),
    })),
    totals: {
      materialBynCents,
      productionBynCents,
      additionalBynCents: manualBynCents,
      technicalTotalCents,
      reserveCents,
      recommendedManagerTotalCents,
      managerAdjustmentCents: adjustmentCents,
      finalQuoteTotalCents,
      publicFromTotalCents,
    },
    settings: { ...pricebook.settings },
  };
  return mode === "public" ? toPublicResult(result) : result;
}

function toPublicResult(result) {
  return {
    schemaVersion: result.schemaVersion,
    pricebookVersion: result.pricebookVersion,
    calculatedAt: result.calculatedAt,
    currency: "BYN",
    wording: "Ориентировочная стоимость от",
    publicFromTotalCents: result.totals.publicFromTotalCents,
    publicFromTotal: result.totals.publicFromTotalCents / 100,
    metrics: result.metrics,
    material: {
      id: result.material.id,
      category: result.material.category,
      title: result.material.title,
    },
  };
}

module.exports = {
  SNAPSHOT_SCHEMA_VERSION,
  calculate,
  roundSlabs,
  roundUpCents,
  toPublicResult,
  usdToBynCents,
};
