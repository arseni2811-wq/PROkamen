"use strict";

const crypto = require("crypto");
const path = require("path");
const { readWorksheet } = require("../utils/xlsxReader");

const REQUIRED_HEADERS = [
  "Бренд", "Категория", "Артикул", "Наименование", "Размер", "Толщина",
  "Поверхность", "Цена", "Валюта", "Единица", "Цена 1/2", "Цена 1/4",
  "Тип цены", "НДС", "Примечание", "Источник", "Место в источнике",
];
const CATEGORY_CODES = new Map([
  ["кварцевый агломерат", "quartz"],
  ["гранит", "granite"],
  ["натуральный гранит", "granite"],
]);
const STANDARD_FORMATS = new Map([
  ["NORMAL", { lengthMm: 3050, widthMm: 1440, code: "normal" }],
  ["НОРМАЛ", { lengthMm: 3050, widthMm: 1440, code: "normal" }],
  ["JUMBO", { lengthMm: 3200, widthMm: 1600, code: "jumbo" }],
  ["SUPER JUMBO", { lengthMm: 3300, widthMm: 1650, code: "super_jumbo" }],
  ["SUPER_JUMBO", { lengthMm: 3300, widthMm: 1650, code: "super_jumbo" }],
]);

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function normalizedText(value) {
  return clean(value).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

function parseDimensions(value, explicitThickness) {
  const source = clean(value).replace(/[–—]/g, "-");
  const match = source.match(/(\d{3,4})\s*[×xх]\s*(\d{3,4})(?:\s*[×xх-]\s*(\d{1,3}))?/i);
  const explicit = clean(explicitThickness).match(/(\d{1,3})/)?.[1];
  if (match) return {
    rawFormat: source || null,
    commercialFormat: source || null,
    lengthMm: Number(match[1]),
    widthMm: Number(match[2]),
    thicknessMm: explicit ? Number(explicit) : match[3] ? Number(match[3]) : null,
    dimensionSource: "explicit",
    standardFormatCode: null,
  };
  const standardName = source.toUpperCase().replace(/\s+/g, " ").trim();
  const standard = STANDARD_FORMATS.get(standardName);
  if (standard) return {
    rawFormat: source,
    commercialFormat: source,
    lengthMm: standard.lengthMm,
    widthMm: standard.widthMm,
    thicknessMm: explicit ? Number(explicit) : null,
    dimensionSource: `mapped_${standard.code}`,
    standardFormatCode: standard.code,
  };
  return {
    rawFormat: source || null,
    commercialFormat: source && !/^\d+(?:[.,]\d+)?$/.test(source) ? source : null,
    lengthMm: null,
    widthMm: null,
    thicknessMm: explicit ? Number(explicit) : null,
    dimensionSource: "unresolved",
    standardFormatCode: null,
  };
}

function parseMoney(value) {
  if (value === null || value === undefined || clean(value) === "") return null;
  const normalized = typeof value === "number"
    ? value
    : Number(clean(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(normalized) && normalized >= 0 ? Math.round(normalized * 100) : NaN;
}

function inferSurface(name, sourceSurface) {
  const surface = clean(sourceSurface);
  if (surface && !Number.isFinite(Number(surface))) return surface;
  const tokens = clean(name).match(/polished|honed|matt|matte|SETA|leather|матов(?:ый|ая|ое)|глянцев(?:ый|ая|ое)/gi);
  if (!tokens) return null;
  return [...new Set(tokens.map((token) => token.toUpperCase() === "SETA" ? "SETA" : token.toLowerCase()))].join("/");
}

function cleanDecorName(value) {
  const sourceName = clean(value);
  const withoutStatus = sourceName
    .replace(/(?:\s+|^)(?:#?\s*O\s*U\s*T|выводится|снят(?:а|о|ы)?(?:\s+с\s+производства)?)(?=\s|$)/giu, " ")
    .replace(/\s+/g, " ").trim();
  return withoutStatus
    .replace(/\s*[#!]?\s*(?:polished(?:\s*\/\s*honed)?|honed|matt|matte|SETA|leather|матов(?:ый|ая|ое)|глянцев(?:ый|ая|ое))\s*!?$/iu, "")
    .trim();
}

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]));
}

function normalizeRow(source, rowNumber, sourceFile) {
  const errors = [];
  const warnings = [];
  const categoryLabel = clean(source["Категория"]);
  const category = CATEGORY_CODES.get(categoryLabel.toLowerCase()) || null;
  const brand = clean(source["Бренд"]);
  const article = clean(source["Артикул"]);
  const sourceName = clean(source["Наименование"]);
  const name = cleanDecorName(sourceName);
  const dimensions = parseDimensions(source["Размер"], source["Толщина"]);
  const currency = clean(source["Валюта"]).toUpperCase();
  let fullPrice = parseMoney(source["Цена"]);
  const surfaceCell = source["Поверхность"];
  if (fullPrice === null && typeof surfaceCell === "number") {
    fullPrice = parseMoney(surfaceCell);
    warnings.push("SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность");
  }
  const halfPrice = parseMoney(source["Цена 1/2"]);
  const quarterPrice = parseMoney(source["Цена 1/4"]);
  const surface = inferSurface(sourceName, surfaceCell);
  const note = clean(source["Примечание"]);
  const discontinued = /#?\s*O\s*U\s*T|выводится|снят(?:а|о|ы)?(?:\s+с\s+производства)?/iu.test(`${sourceName} ${note}`);

  if (!brand) errors.push("нет бренда");
  if (!name) errors.push("нет наименования");
  if (!dimensions.lengthMm || !dimensions.widthMm) errors.push("нет однозначных физических размеров слэба");
  if (!dimensions.thicknessMm) errors.push("нет толщины");
  if (!currency || !["USD", "EUR"].includes(currency)) errors.push("неизвестная валюта");
  if (Number.isNaN(fullPrice) || Number.isNaN(halfPrice) || Number.isNaN(quarterPrice)) errors.push("отрицательная или некорректная цена");
  if (fullPrice === null && halfPrice === null && quarterPrice === null) errors.push("нет цены");
  if (halfPrice !== null && fullPrice !== null && (halfPrice < fullPrice * 0.2 || halfPrice > fullPrice)) {
    warnings.push("HIGH suspicious_half_price: подозрительное соотношение HALF/FULL");
  }
  if (category === "granite" && !["гранит", "натуральный гранит"].includes(categoryLabel.toLowerCase())) {
    errors.push("гранит определён не по допустимой категории");
  }

  const materialIdentity = [normalizedText(brand), normalizedText(article) || normalizedText(name)].join("|");
  const materialKey = hash(materialIdentity);
  const variantIdentity = [materialKey, dimensions.lengthMm, dimensions.widthMm,
    dimensions.thicknessMm, normalizedText(surface) || "default"].join("|");
  const variantKey = hash(variantIdentity);
  const prices = [
    [1, fullPrice], [0.5, halfPrice], [0.25, quarterPrice],
  ].filter(([, amountMinor]) => amountMinor !== null && !Number.isNaN(amountMinor)).map(([fraction, amountMinor]) => ({
    fraction,
    amountMinor,
    currency,
    fingerprint: hash([variantKey, fraction, amountMinor, currency, clean(source["Тип цены"]), sourceFile, clean(source["Место в источнике"])].join("|")),
  }));

  return {
    sourceRow: rowNumber,
    category,
    categoryLabel,
    brand,
    article,
    name,
    sourceName,
    materialKey,
    variantKey,
    ...dimensions,
    surface,
    unit: clean(source["Единица"]),
    priceType: clean(source["Тип цены"]),
    vatInfo: clean(source["НДС"]),
    note,
    sourceFile,
    sourceLocation: clean(source["Место в источнике"]) || clean(source["Источник"]),
    discontinued,
    sourceValues: Object.fromEntries(REQUIRED_HEADERS.map((header) => [header, source[header] ?? null])),
    prices,
    errors,
    warnings,
  };
}

function rebuildIdentities(rows, sourceFile) {
  const articleGroups = new Map();
  for (const row of rows) {
    if (!row.brand || !row.article || !row.name) continue;
    const key = `${normalizedText(row.brand)}|${normalizedText(row.article)}`;
    const group = articleGroups.get(key) || new Set();
    group.add(normalizedText(row.name));
    articleGroups.set(key, group);
  }
  const conflicts = new Map([...articleGroups].filter(([, names]) => names.size > 1));
  for (const row of rows) {
    const articleKey = `${normalizedText(row.brand)}|${normalizedText(row.article)}`;
    const hasConflict = Boolean(row.article && conflicts.has(articleKey));
    if (hasConflict) row.warnings.push("ARTICLE_NAME_CONFLICT");
    const materialIdentity = row.article
      ? [normalizedText(row.brand), normalizedText(row.article), hasConflict ? normalizedText(row.name) : ""].join("|")
      : [normalizedText(row.brand), normalizedText(row.name)].join("|");
    row.materialKey = hash(materialIdentity);
    row.variantKey = hash([
      row.materialKey, row.lengthMm, row.widthMm, row.thicknessMm,
      normalizedText(row.surface) || "default",
    ].join("|"));
    for (const price of row.prices) {
      price.fingerprint = hash([
        row.variantKey, price.fraction, price.amountMinor, price.currency,
        row.priceType, sourceFile, row.sourceLocation,
      ].join("|"));
    }
  }
  return [...conflicts].map(([key, names]) => ({ key, names: [...names] }));
}

function analyzeWorkbook(filePath) {
  const rows = readWorksheet(filePath, "Товары");
  if (!rows.length) throw new Error("Лист «Товары» пуст");
  const headers = rows[0].map(clean);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`В XLSX отсутствуют колонки: ${missingHeaders.join(", ")}`);
  const sourceFile = path.basename(filePath);
  const allRows = rows.slice(1).map((row, index) => normalizeRow(rowObject(headers, row), index + 2, sourceFile));
  const acceptedCategories = allRows.filter((row) => row.category === "quartz" || row.category === "granite");
  const articleNameConflicts = rebuildIdentities(acceptedCategories, sourceFile);
  const candidates = acceptedCategories.filter((row) => row.errors.length === 0);
  const variantCounts = candidates.reduce((counts, row) => counts.set(row.variantKey, (counts.get(row.variantKey) || 0) + 1), new Map());
  const duplicateCandidates = [...variantCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return { headers, allRows, acceptedCategories, candidates, duplicateCandidates, articleNameConflicts, sourceFile };
}

function fractionalPrice(prices, slabCount) {
  const count = Number(slabCount);
  if (!Number.isFinite(count) || count < 0 || Math.round(count * 2) !== count * 2) {
    throw new TypeError("Расход слэбов должен быть неотрицательным числом с шагом 0.5");
  }
  const full = Number(prices?.["1"] ?? prices?.[1]);
  const half = Number(prices?.["0.5"] ?? prices?.[0.5]);
  if (!Number.isSafeInteger(full) || full < 0) throw new TypeError("Отсутствует цена полного слэба");
  if (count % 1 !== 0 && (!Number.isSafeInteger(half) || half < 0)) {
    throw new TypeError("Для дробного расхода отсутствует цена половины слэба");
  }
  return Math.floor(count) * full + (count % 1 === 0.5 ? half : 0);
}

function calculatorPriceDecision(row, { activePriceType = null } = {}) {
  const hasBlockingWarning = row.warnings.some((warning) =>
    /^HIGH\s/i.test(warning) || warning.includes("suspicious_half_price"),
  );
  const full = row.prices.find((price) => price.fraction === 1);
  const half = row.prices.find((price) => price.fraction === 0.5);
  const priceTypeAllowed = !activePriceType || row.priceType === activePriceType;
  const calculatorReady = Boolean(
    row.lengthMm && row.widthMm && row.thicknessMm && full && half &&
    full.currency === "USD" && half.currency === "USD" &&
    !hasBlockingWarning && !row.discontinued && priceTypeAllowed,
  );
  return {
    calculatorReady,
    hasBlockingWarning,
    calculatorAmountUsdCents(price) {
      return price.currency === "USD" && !hasBlockingWarning ? price.amountMinor : null;
    },
    isCalculatorPrice(price) {
      return calculatorReady && price.currency === "USD";
    },
  };
}

module.exports = {
  REQUIRED_HEADERS,
  STANDARD_FORMATS,
  analyzeWorkbook,
  calculatorPriceDecision,
  cleanDecorName,
  fractionalPrice,
  hash,
  inferSurface,
  normalizeRow,
  parseDimensions,
  parseMoney,
  rebuildIdentities,
};
