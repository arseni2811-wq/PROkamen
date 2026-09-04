"use strict";

const SNAPSHOT_SCHEMA_VERSION = 2;
const BPS = 10000;
const EDGE_RATE_BY_PROFILE = Object.freeze({
  model_1: "edge_standard",
  model_2: "edge_round",
  model_3: "edge_round",
  model_4: "edge_standard",
  model_5: "edge_standard",
  model_6: "edge_standard",
  model_7: "edge_standard",
});
// edge_reinforced depends on a future finishedThickness field, not on profile shape.

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

function minorToBynCents(amountMinor, exchangeRateScaled) {
  return Math.round(asNonNegativeInteger(amountMinor, "Сумма материала") * asNonNegativeInteger(exchangeRateScaled, "Курс") / BPS);
}

function roundUpCents(value, stepCents) {
  const step = Math.max(1, asNonNegativeInteger(stepCents, "Шаг округления"));
  return Math.ceil(asNonNegativeInteger(value, "Сумма") / step) * step;
}

function roundSlabs(value) {
  return Math.ceil(asNonNegativeNumber(value, "Расход слэбов") * 2) / 2;
}

function roundMeters(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function normalizedSides(value, defaults) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, source[key] === undefined ? fallback : Boolean(source[key])]),
  );
}

function buildSlabLayout(items, slabLengthMm, slabWidthMm, kerfMm = 4) {
  const parts = [];
  items.forEach((item, itemIndex) => {
    if (item.productType === "table" && ["round", "oval"].includes(item.tableShape)) {
      const piece = item.pieces[0];
      if (piece.lengthMm > slabLengthMm || piece.widthMm > slabWidthMm) {
        throw new TypeError(`Стол ${itemIndex + 1} целиком не помещается в выбранный слэб`);
      }
    }
    item.pieces.forEach((piece, pieceIndex) => {
      if (piece.widthMm > slabWidthMm) {
        throw new TypeError(`Глубина детали ${itemIndex + 1}.${pieceIndex + 1} больше ширины выбранного слэба`);
      }
      let remaining = piece.lengthMm;
      let segmentIndex = 0;
      while (remaining > 0) {
        const lengthMm = Math.min(remaining, slabLengthMm);
        parts.push({
          itemIndex,
          pieceIndex,
          segmentIndex,
          lengthMm,
          widthMm: piece.widthMm,
          continuation: segmentIndex > 0,
        });
        remaining -= lengthMm;
        segmentIndex += 1;
      }
    });
    if (item.wallPanel) {
      const geometry = itemGeometry({ ...item, wallPanel: false }, slabLengthMm);
      const panelLengthMm = Math.round((item.wallPanelAutoLength !== false
        ? geometry.backLengthM
        : item.wallPanelLengthM) * 1000);
      if (item.wallPanelHeightMm > slabWidthMm) {
        throw new TypeError(`Высота скинали изделия ${itemIndex + 1} больше ширины выбранного слэба`);
      }
      let remaining = panelLengthMm;
      let segmentIndex = 0;
      while (remaining > 0) {
        const lengthMm = Math.min(remaining, slabLengthMm);
        parts.push({ itemIndex, pieceIndex: -1, segmentIndex, lengthMm, widthMm: item.wallPanelHeightMm, wallPanel: true, continuation: segmentIndex > 0 });
        remaining -= lengthMm;
        segmentIndex += 1;
      }
    }
  });

  const slabs = [];
  const sorted = [...parts].sort((a, b) => b.widthMm - a.widthMm || b.lengthMm - a.lengthMm);
  for (const part of sorted) {
    let placement = null;
    for (const slab of slabs) {
      for (const shelf of slab.shelves) {
        if (part.widthMm <= shelf.heightMm && shelf.xMm + part.lengthMm <= slabLengthMm) {
          placement = { slab, shelf, xMm: shelf.xMm, yMm: shelf.yMm };
          shelf.xMm += part.lengthMm + kerfMm;
          break;
        }
      }
      if (placement) break;
      const usedHeightMm = slab.shelves.reduce((sum, shelf) => sum + shelf.heightMm + kerfMm, 0);
      if (usedHeightMm + part.widthMm <= slabWidthMm) {
        const shelf = { yMm: usedHeightMm, xMm: part.lengthMm + kerfMm, heightMm: part.widthMm };
        slab.shelves.push(shelf);
        placement = { slab, shelf, xMm: 0, yMm: usedHeightMm };
        break;
      }
    }
    if (!placement) {
      const slab = { index: slabs.length, shelves: [{ yMm: 0, xMm: part.lengthMm + kerfMm, heightMm: part.widthMm }], parts: [] };
      slabs.push(slab);
      placement = { slab, xMm: 0, yMm: 0 };
    }
    placement.slab.parts.push({ ...part, xMm: placement.xMm, yMm: placement.yMm });
  }
  return {
    kerfMm,
    slabLengthMm,
    slabWidthMm,
    physicalSlabCount: slabs.length,
    slabs: slabs.map(({ index, parts: slabParts }) => ({ index, parts: slabParts })),
  };
}

function itemGeometry(item, slabLengthMm = Infinity) {
  const pieces = item.pieces || [];
  const first = pieces[0];
  if (!first) throw new TypeError("У изделия отсутствуют размеры");
  const usableSlabLengthMm = Number(slabLengthMm);
  const splitBySlabLength = Number.isFinite(usableSlabLengthMm) && usableSlabLengthMm > 0;
  const lengthSplitCount = splitBySlabLength
    ? pieces.reduce(
        (sum, piece) => sum + Math.max(0, Math.ceil(piece.lengthMm / usableSlabLengthMm) - 1),
        0,
      )
    : 0;
  const jointPolishM = splitBySlabLength
    ? roundMeters(pieces.reduce((sum, piece) => {
        const splits = Math.max(0, Math.ceil(piece.lengthMm / usableSlabLengthMm) - 1);
        return sum + splits * piece.widthMm / 1000;
      }, 0))
    : 0;
  const usesSlabEdges = item.productType === "countertop" || item.productType === "windowsill";
  const roundedCorners = Math.min(4, Math.max(0, Number(item.roundedCorners || 0)));
  if (roundedCorners > 0 && Number(item.cornerRadiusMm || 0) > Math.min(first.lengthMm, first.widthMm) / 2) {
    throw new TypeError("Закругление не может быть больше половины меньшей стороны изделия");
  }
  const radiusMm = Math.min(
    Number(item.cornerRadiusMm || 0),
    first.lengthMm / 2,
    first.widthMm / 2,
  );
  const frontLengthM = roundMeters(
    pieces.reduce((sum, piece) => sum + piece.lengthMm / 1000, 0),
  );
  const edgeSides = normalizedSides(item.edgeSides, { front: true, left: false, right: false });
  const wallSides = normalizedSides(item.wallSides, { back: true, left: false, right: false });
  const selectedEdgeLengthM = roundMeters(
    (edgeSides.front ? frontLengthM : 0) +
    (edgeSides.left ? first.widthMm / 1000 : 0) +
    (edgeSides.right ? pieces[pieces.length - 1].widthMm / 1000 : 0),
  );
  const backLengthM = roundMeters(
    (wallSides.back ? frontLengthM : 0) +
    (wallSides.left ? first.widthMm / 1000 : 0) +
    (wallSides.right ? pieces[pieces.length - 1].widthMm / 1000 : 0),
  );
  let areaMm2;
  let exteriorStraightCutM;
  let curvedCutM = 0;

  if (item.productType === "table" && item.tableShape === "round") {
    const diameterMm = first.lengthMm;
    const radiusMm = diameterMm / 2;
    areaMm2 = Math.PI * radiusMm * radiusMm;
    exteriorStraightCutM = 0;
    curvedCutM = roundMeters(Math.PI * diameterMm / 1000);
  } else if (item.productType === "table" && item.tableShape === "oval") {
    const radiusA = first.lengthMm / 2;
    const radiusB = first.widthMm / 2;
    const h = ((radiusA - radiusB) ** 2) / ((radiusA + radiusB) ** 2);
    areaMm2 = Math.PI * radiusA * radiusB;
    exteriorStraightCutM = 0;
    curvedCutM = roundMeters(
      Math.PI * (radiusA + radiusB) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h))) / 1000,
    );
  } else if (item.productType === "bar") {
    if (first.lengthMm < first.widthMm / 2) {
      throw new TypeError("Длина барной стойки должна быть не меньше половины её глубины");
    }
    const endRadiusMm = Math.min(first.widthMm / 2, first.lengthMm);
    areaMm2 =
      (first.lengthMm - endRadiusMm) * first.widthMm +
      Math.PI * endRadiusMm * endRadiusMm / 2;
    exteriorStraightCutM = roundMeters(
      (2 * (first.lengthMm - endRadiusMm) + first.widthMm) / 1000,
    );
    curvedCutM = roundMeters(Math.PI * endRadiusMm / 1000);
  } else {
    areaMm2 = pieces.reduce(
      (sum, piece) => sum + piece.lengthMm * piece.widthMm,
      0,
    );
    if (roundedCorners > 0 && radiusMm > 0) {
      areaMm2 -= roundedCorners * radiusMm * radiusMm * (1 - Math.PI / 4);
      curvedCutM = roundMeters(roundedCorners * Math.PI * radiusMm / 2 / 1000);
    }
    exteriorStraightCutM = roundMeters(
      pieces.reduce(
        (sum, piece) => sum + 2 *
          (piece.lengthMm + piece.widthMm) / 1000,
        0,
      ) - (usesSlabEdges ? 0 : roundedCorners * 2 * radiusMm / 1000),
    );
  }

  const polishedSides = Math.min(4, Math.max(1, Number(item.polishedSides || 1)));
  const wallPanelLengthM = item.wallPanel
    ? (item.wallPanelAutoLength !== false ? backLengthM : Number(item.wallPanelLengthM || 0))
    : 0;
  const wallPanelHeightMm = item.wallPanel ? Number(item.wallPanelHeightMm || 600) : 0;
  const wallPanelAreaM2 = roundMeters(wallPanelLengthM * wallPanelHeightMm / 1000);
  const wallPanelCutM = item.wallPanel && wallPanelLengthM > 0
    ? roundMeters(wallPanelLengthM + wallPanelHeightMm / 1000)
    : 0;
  const straightCutM = roundMeters(
    exteriorStraightCutM + (usesSlabEdges ? 0 : jointPolishM) + wallPanelCutM,
  );
  let processedEdgeM;
  if (usesSlabEdges) {
    processedEdgeM = selectedEdgeLengthM;
  } else if (
    polishedSides === 4 ||
    item.productType === "island" ||
    item.productType === "bar" ||
    item.productType === "table"
  ) {
    processedEdgeM = roundMeters(exteriorStraightCutM + curvedCutM);
  } else {
    processedEdgeM = frontLengthM +
      (polishedSides >= 2 ? pieces[0].widthMm / 1000 : 0) +
      (polishedSides >= 3 ? pieces[pieces.length - 1].widthMm / 1000 : 0);
    if (roundedCorners > 0 && radiusMm > 0) {
      processedEdgeM += roundedCorners * (Math.PI * radiusMm / 2 - 2 * radiusMm) / 1000;
    }
    processedEdgeM = roundMeters(Math.max(0, processedEdgeM));
  }
  return {
    productType: item.productType,
    shape: item.shape,
    tableShape: item.tableShape || "rectangle",
    productAreaM2: Math.round(areaMm2) / 1000000,
    wallPanelAreaM2,
    areaM2: Math.round((areaMm2 / 1000000 + wallPanelAreaM2) * 1000000) / 1000000,
    straightCutM,
    curvedCutM,
    processedEdgeM,
    lengthSplitCount,
    jointPolishM,
    backLengthM: item.productType === "countertop" || item.productType === "windowsill"
      ? backLengthM
      : 0,
    wallPanelLengthM,
    wallPanelHeightMm,
    edgeSides,
    wallSides,
    installationM: item.productType === "island" || item.productType === "bar" || item.productType === "table"
      ? roundMeters(first.lengthMm / 1000)
      : frontLengthM,
    jointCount: (item.shape === "u"
      ? 2
      : item.shape === "l"
        ? 1
        : 0) + lengthSplitCount,
  };
}

function automaticQuantities(item, geometry = itemGeometry(item), slabFormat = {}) {
  if (!item.automaticGeometry) return [];
  const result = item.edgeCode && geometry.processedEdgeM > 0
    ? [{ code: item.edgeCode, quantity: geometry.processedEdgeM }]
    : [];
  if (geometry.curvedCutM > 0) {
    result.push({ code: "cut_curved", quantity: geometry.curvedCutM });
  }
  if (geometry.jointCount) {
    const jointCode = Math.max(...item.pieces.map((piece) => piece.widthMm)) <= 700
      ? "joint_short"
      : "joint_long";
    result.push({ code: jointCode, quantity: geometry.jointCount });
  }
  if (
    geometry.jointPolishM > 0 &&
    item.productType !== "countertop" &&
    item.productType !== "windowsill"
  ) {
    const polishCode = Number(slabFormat.thicknessMm || 20) >= 40
      ? "polish_40"
      : "polish_20";
    result.push({ code: polishCode, quantity: geometry.jointPolishM });
  }
  if (item.sinkType === "top") result.push({ code: "cutout_sink_top", quantity: 1 });
  if (item.sinkType === "under") result.push({ code: "cutout_sink_under", quantity: 1 });
  if (item.sinkType === "stone") result.push({ code: "stone_sink", quantity: 1 });
  if (item.hob) result.push({ code: "cutout_hob", quantity: 1 });
  if (item.tapHole) result.push({ code: "hole_faucet", quantity: 1 });
  if (Number(item.socketHoles || 0) > 0) {
    result.push({ code: "hole_socket", quantity: Number(item.socketHoles) });
  }
  if (Number(item.dispenserHoles || 0) > 0) {
    result.push({ code: "hole_dispenser", quantity: Number(item.dispenserHoles) });
  }
  if (Number(item.roundCutouts || 0) > 0) {
    result.push({ code: "cutout_round", quantity: Number(item.roundCutouts) });
  }
  if (Number(item.otherHoles || 0) > 0) {
    result.push({ code: "hole_standard", quantity: Number(item.otherHoles) });
  }
  const backsplashType = item.backsplashType || (item.backsplash ? "straight" : "none");
  const backsplashLengthM = Number(item.backsplashLengthM || 0) > 0
    ? Number(item.backsplashLengthM)
    : geometry.installationM;
  const wallPanelLengthM = item.wallPanelAutoLength !== false
    ? geometry.backLengthM
    : Number(item.wallPanelLengthM || 0);
  if (backsplashType === "straight") {
    result.push({ code: "backsplash_make", quantity: backsplashLengthM });
  }
  if (item.wallPanel) result.push({ code: "wall_panel", quantity: wallPanelLengthM });
  if (item.installation) {
    result.push({
      code: item.productType === "windowsill" ? "install_sill" : "install_countertop",
      quantity: geometry.installationM,
    });
    if (item.sinkType === "under") result.push({ code: "install_sink", quantity: 1 });
    if (backsplashType === "straight") result.push({ code: "install_plinth", quantity: backsplashLengthM });
    if (item.wallPanel) result.push({ code: "install_wall_panel", quantity: wallPanelLengthM });
  }
  return result;
}

function normalizePieces(configuration, slabLengthMm = Infinity) {
  const items = Array.isArray(configuration.items) ? configuration.items : [];
  if (items.length === 0) throw new TypeError("Добавьте хотя бы одно изделие");

  return items.map((item, itemIndex) => {
    const productType = item.productType || "countertop";
    const edgeProfileModel = item.edgeProfileModel || "model_1";
    const profileRateCode =
      (productType === "countertop" || productType === "windowsill") &&
      item.edgeProfileModel
        ? EDGE_RATE_BY_PROFILE[edgeProfileModel]
        : null;
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
    const normalized = {
      productType,
      shape: item.shape || "straight",
      tableShape: item.tableShape || "rectangle",
      pieces,
      operations: Array.isArray(item.operations) ? item.operations : [],
      edgeCode: profileRateCode || item.edgeCode || null,
      edgeProfileModel,
      automaticGeometry: Boolean(item.automaticGeometry),
      polishedSides: asNonNegativeInteger(item.polishedSides || 1, "Количество полируемых сторон"),
      roundedCorners: asNonNegativeInteger(item.roundedCorners, "Количество скруглённых углов"),
      cornerRadiusMm: asNonNegativeNumber(item.cornerRadiusMm || 0, "Радиус скругления"),
      installation: Boolean(item.installation),
      backsplash: Boolean(item.backsplash),
      backsplashType: item.backsplashType || (item.backsplash ? "straight" : "none"),
      backsplashLengthM: asNonNegativeNumber(item.backsplashLengthM, "Длина бортика"),
      wallPanel: Boolean(item.wallPanel),
      wallPanelAutoLength: item.wallPanelAutoLength !== false,
      wallPanelLengthM: asNonNegativeNumber(item.wallPanelLengthM, "Длина скинали"),
      wallPanelHeightMm: asNonNegativeNumber(item.wallPanelHeightMm || 600, "Высота скинали"),
      edgeSides: normalizedSides(item.edgeSides, { front: true, left: false, right: false }),
      wallSides: normalizedSides(item.wallSides, { back: true, left: false, right: false }),
      sinkType: item.sinkType || "none",
      hob: Boolean(item.hob),
      tapHole: Boolean(item.tapHole),
      socketHoles: asNonNegativeInteger(item.socketHoles, "Отверстия под розетки"),
      dispenserHoles: asNonNegativeInteger(item.dispenserHoles, "Отверстия под дозатор"),
      roundCutouts: asNonNegativeInteger(item.roundCutouts, "Круглые вырезы"),
      otherHoles: asNonNegativeInteger(item.otherHoles, "Дополнительные отверстия"),
      measurementRequested: Boolean(item.measurementRequested),
      deliveryRequested: Boolean(item.deliveryRequested),
      liftingRequested: Boolean(item.liftingRequested),
      processedEdgeM: item.automaticGeometry
        ? 0
        : asNonNegativeNumber(item.processedEdgeM, "Длина кромки"),
      straightCutM: 0,
    };
    normalized.straightCutM = item.straightCutM === undefined
      ? itemGeometry(normalized, slabLengthMm).straightCutM
      : asNonNegativeNumber(item.straightCutM, "Прямой раскрой");
    return normalized;
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

function calculateMaterial(
  material,
  slabCount,
  areaM2,
  minimumMarkupBps,
  managerMarkupBps,
  manualUsdCents,
) {
  let baseUsdCents;
  let baseMinor;
  switch (material.priceUnit) {
    case "slab":
      if (material.fractionPricesMinor) {
        const full = asNonNegativeInteger(material.fractionPricesMinor["1"], "Цена полного слэба");
        const half = asNonNegativeInteger(material.fractionPricesMinor["0.5"], "Цена половины слэба");
        baseMinor = Math.floor(slabCount) * full + (slabCount % 1 === 0.5 ? half : 0);
        baseUsdCents = material.sourceCurrency === "USD" ? baseMinor : 0;
        break;
      }
      if (material.fractionPricesUsdCents) {
        if (material.importKey && (
          material.fractionPricesUsdCents["1"] === undefined ||
          material.fractionPricesUsdCents["0.5"] === undefined
        )) {
          throw new TypeError("Для импортированного материала необходимы цены полного и половины слэба");
        }
        const full = asNonNegativeInteger(material.fractionPricesUsdCents["1"], "Цена полного слэба");
        const wholeSlabs = Math.floor(slabCount);
        const hasHalf = slabCount % 1 === 0.5;
        if (hasHalf && material.fractionPricesUsdCents["0.5"] === undefined) {
          throw new TypeError("Для дробного расхода отсутствует цена половины слэба");
        }
        const half = hasHalf ? asNonNegativeInteger(material.fractionPricesUsdCents["0.5"], "Цена половины слэба") : 0;
        baseUsdCents = wholeSlabs * full + half;
      } else {
        baseUsdCents = multiplyCents(material.basePriceUsdCents, slabCount);
      }
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
    asNonNegativeInteger(minimumMarkupBps, "Минимальная наценка"),
    asNonNegativeInteger(managerMarkupBps, "Наценка менеджера"),
  );
  return {
    baseUsdCents,
    baseMinor: baseMinor ?? baseUsdCents,
    markupBps: effectiveMarkupBps,
    totalUsdCents: Math.round(baseUsdCents * (BPS + effectiveMarkupBps) / BPS),
    totalMinor: Math.round((baseMinor ?? baseUsdCents) * (BPS + effectiveMarkupBps) / BPS),
  };
}

function calculate(configuration, pricebook, mode = "internal") {
  if (!pricebook || !pricebook.material || !pricebook.slabFormat) {
    throw new TypeError("Не переданы материал и формат слэба");
  }
  const slabLengthMm = asNonNegativeNumber(pricebook.slabFormat.lengthMm, "Длина слэба");
  const slabWidthMm = asNonNegativeNumber(pricebook.slabFormat.widthMm, "Ширина слэба");
  const piecesByItem = normalizePieces(configuration, slabLengthMm);
  const itemGeometries = piecesByItem.map((item) => itemGeometry(item, slabLengthMm));
  const slabLayout = buildSlabLayout(piecesByItem, slabLengthMm, slabWidthMm);
  const areaM2 = Math.round(
    itemGeometries.reduce((sum, geometry) => sum + geometry.areaM2, 0) * 1000000,
  ) / 1000000;
  const wasteBps = asNonNegativeInteger(pricebook.settings.wasteBps, "Отходы");
  const areaWithWasteM2 = areaM2 * (BPS + wasteBps) / BPS;
  const slabAreaM2 =
    slabLengthMm *
    slabWidthMm /
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
    configuration.materialMarkupBps,
    configuration.manualMaterialPriceUsdCents,
  );

  const rates = new Map(pricebook.rates.map((rate) => [rate.systemCode, rate]));
  const quantities = new Map();
  for (const [itemIndex, item] of piecesByItem.entries()) {
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
    for (const operation of automaticQuantities(
      item,
      itemGeometries[itemIndex],
      pricebook.slabFormat,
    )) {
      quantities.set(
        operation.code,
        (quantities.get(operation.code) || 0) + operation.quantity,
      );
    }
    if (item.edgeCode && item.processedEdgeM > 0) {
      quantities.set(
        item.edgeCode,
        (quantities.get(item.edgeCode) || 0) + item.processedEdgeM,
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

  if (quantities.has("manual_polish_area")) {
    const quantity = quantities.get("manual_polish_area");
    quantities.delete("manual_polish_area");
    const code = areaM2 <= 1 ? "manual_polish_small" : "manual_polish_large";
    quantities.set(code, (quantities.get(code) || 0) + quantity);
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
  const additionalMaterialBynCents = asNonNegativeInteger(
    configuration.additionalMaterialBynCents,
    "Дополнительная стоимость материала",
  );
  const materialRate = pricebook.material.sourceCurrency
    ? pricebook.exchangeRates?.[pricebook.material.sourceCurrency]?.bynPerUnitScaled
    : pricebook.exchangeRateScaled;
  if (!materialRate) throw new TypeError("Для валюты материала не задан прямой курс к BYN");
  const materialBynCents =
    minorToBynCents(material.totalMinor, materialRate) +
    additionalMaterialBynCents;
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
      manufacturer: pricebook.material.manufacturer || null,
      series: pricebook.material.series || null,
      sku: pricebook.material.sku || null,
      slabFormat: pricebook.slabFormat,
      slabCount,
      automaticSlabCount,
      basePriceUsdCents: pricebook.material.basePriceUsdCents,
      materialId: pricebook.material.id,
      materialVariantId: pricebook.material.materialVariantId || null,
      commercialFormat: pricebook.material.commercialFormat || null,
      dimensions: pricebook.material.materialVariantId
        ? {
            lengthMm: pricebook.material.lengthMm,
            widthMm: pricebook.material.widthMm,
            thicknessMm: pricebook.material.thicknessMm,
          }
        : null,
      surface: pricebook.material.surface || null,
      fullPriceUsdCents: pricebook.material.fractionPricesUsdCents?.["1"] ?? null,
      halfPriceUsdCents: pricebook.material.fractionPricesUsdCents?.["0.5"] ?? null,
      materialBaseUsdCents: material.baseUsdCents,
      sourceCurrency: pricebook.material.sourceCurrency || "USD",
      fullPriceMinor: pricebook.material.fractionPricesMinor?.["1"] ?? pricebook.material.fractionPricesUsdCents?.["1"] ?? null,
      halfPriceMinor: pricebook.material.fractionPricesMinor?.["0.5"] ?? pricebook.material.fractionPricesUsdCents?.["0.5"] ?? null,
      materialBaseMinor: material.baseMinor,
      materialTotalMinor: material.totalMinor,
      exchangeRateToBynScaled: materialRate,
      exchangeRateDate: pricebook.exchangeRates?.[pricebook.material.sourceCurrency]?.rateDate || null,
      markupBps: material.markupBps,
      materialUsdCents: material.totalUsdCents,
      materialBynCents,
      additionalMaterialBynCents,
    },
    metrics: {
      areaM2,
      areaWithWasteM2,
      slabAreaM2,
      straightCutM: roundMeters(itemGeometries.reduce((sum, item) => sum + item.straightCutM, 0)),
      curvedCutM: roundMeters(itemGeometries.reduce((sum, item) => sum + item.curvedCutM, 0)),
      processedEdgeM: roundMeters(itemGeometries.reduce((sum, item) => sum + item.processedEdgeM, 0)),
      jointCount: itemGeometries.reduce((sum, item) => sum + item.jointCount, 0),
      wallPanelAreaM2: roundMeters(itemGeometries.reduce((sum, item) => sum + item.wallPanelAreaM2, 0)),
      slabLayout,
      items: itemGeometries,
    },
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
    publicWording: pricebook.publicWording,
  };
  return mode === "public" ? toPublicResult(result) : result;
}

function toPublicResult(result) {
  const publicTotalCents = result.totals.publicFromTotalCents;
  const sourceParts = [
    { type: "material", amountBynCents: result.totals.materialBynCents },
    ...result.lines
      .filter((line) => Number(line.amountBynCents) > 0)
      .map((line) => ({ type: "line", line, amountBynCents: line.amountBynCents })),
  ];
  const sourceTotalCents = sourceParts.reduce((sum, part) => sum + part.amountBynCents, 0);
  let allocatedCents = 0;
  const allocatedParts = sourceParts.map((part, index) => {
    const remainingCents = Math.max(0, publicTotalCents - allocatedCents);
    const amountBynCents = index === sourceParts.length - 1
      ? remainingCents
      : sourceTotalCents > 0
        ? Math.min(remainingCents, Math.round(part.amountBynCents * publicTotalCents / sourceTotalCents))
        : 0;
    allocatedCents += amountBynCents;
    return { ...part, amountBynCents };
  });
  const materialPart = allocatedParts.find((part) => part.type === "material");
  const worksBynCents = allocatedParts
    .filter((part) => part.type === "line")
    .reduce((sum, part) => sum + part.amountBynCents, 0);
  return {
    schemaVersion: result.schemaVersion,
    pricebookVersion: result.pricebookVersion,
    calculatedAt: result.calculatedAt,
    currency: "BYN",
    wording: result.publicWording || "Ориентировочная стоимость от",
    publicFromTotalCents: result.totals.publicFromTotalCents,
    publicFromTotal: result.totals.publicFromTotalCents / 100,
    metrics: result.metrics,
    material: {
      id: result.material.id,
      category: result.material.category,
      title: result.material.title,
      manufacturer: result.material.manufacturer,
      series: result.material.series,
      sku: result.material.sku,
      slabFormat: result.material.slabFormat,
      slabCount: result.material.slabCount,
      amountBynCents: materialPart?.amountBynCents || 0,
    },
    totals: {
      materialBynCents: materialPart?.amountBynCents || 0,
      worksBynCents,
      publicFromTotalCents: publicTotalCents,
    },
  };
}

module.exports = {
  SNAPSHOT_SCHEMA_VERSION,
  automaticQuantities,
  calculate,
  itemGeometry,
  buildSlabLayout,
  roundSlabs,
  roundUpCents,
  toPublicResult,
  usdToBynCents,
  minorToBynCents,
  calculateMaterial,
};
