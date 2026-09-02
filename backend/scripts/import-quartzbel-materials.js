"use strict";

const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { analyzeWorkbook, calculatorPriceDecision } = require("../services/materialImportService");

function parseArguments(argv) {
  const options = { dryRun: false, eurPerUsd: null, exchangeRateDate: null, activePriceType: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") options.dryRun = true;
    else if (value === "--eur-per-usd") options.eurPerUsd = Number(argv[++index]);
    else if (value === "--exchange-rate-date") options.exchangeRateDate = argv[++index];
    else if (value === "--active-price-type") options.activePriceType = argv[++index];
    else if (!options.filePath) options.filePath = path.resolve(value);
    else throw new Error(`Неизвестный аргумент: ${value}`);
  }
  if (!options.filePath) throw new Error("Укажите путь к XLSX");
  if (!fs.existsSync(options.filePath)) throw new Error(`Файл не найден: ${options.filePath}`);
  if (options.eurPerUsd !== null && (!Number.isFinite(options.eurPerUsd) || options.eurPerUsd <= 0)) {
    throw new Error("--eur-per-usd должен быть положительным числом");
  }
  return options;
}

async function currentState(connection) {
  const [[databaseRow]] = await connection.query("SELECT DATABASE() AS database_name");
  if (databaseRow?.database_name !== "pro_erp_test") {
    throw new Error(`Импорт разрешён только в pro_erp_test; подключена ${databaseRow?.database_name || "неизвестная БД"}`);
  }
  const [[importKeyColumn]] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'materials' AND column_name = 'import_key'`,
  );
  const [materials] = await connection.query(
    `SELECT material_id, fabricator, sku, title,
            ${Number(importKeyColumn.count) ? "import_key" : "NULL AS import_key"}
     FROM materials`,
  );
  const [formats] = await connection.query(
    "SELECT format_id, system_code, length_mm, width_mm, thickness_mm FROM calculator_slab_formats",
  );
  const [tables] = await connection.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('material_variants','material_prices')",
  );
  return {
    database: databaseRow.database_name,
    materials,
    formats,
    variantSchemaReady: tables.length === 2,
  };
}

function formatIdentity(row) {
  return [row.lengthMm, row.widthMm, row.thicknessMm].join("x");
}

function buildSummary(analysis, state) {
  const accepted = analysis.acceptedCategories;
  const candidates = analysis.candidates;
  const currentBrands = new Set(state.materials.map((row) => String(row.fabricator || "").trim()).filter(Boolean));
  const brands = [...new Set(accepted.map((row) => row.brand).filter(Boolean))].sort();
  const dimensions = [...new Set(accepted.map((row) => row.lengthMm && row.widthMm
    ? `${row.lengthMm}×${row.widthMm}×${row.thicknessMm || "?"}`
    : row.commercialFormat || "не указан").filter(Boolean))].sort();
  const currencies = [...new Set(accepted.map((row) => row.prices.map((price) => price.currency)).flat().filter(Boolean))].sort();
  const existingFormats = new Set(state.formats.map((row) => [Number(row.length_mm), Number(row.width_mm), Number(row.thickness_mm)].join("x")));
  const candidateMaterialKeys = new Set(candidates.map((row) => row.materialKey));
  const existingImportKeys = new Set(state.materials.map((row) => row.import_key).filter(Boolean));
  const updatingMaterials = [...candidateMaterialKeys].filter((key) => existingImportKeys.has(key)).length;
  const uniqueCandidateFormats = new Set(candidates.map(formatIdentity));
  const priceCounts = { FULL: 0, HALF: 0, QUARTER: 0 };
  for (const row of accepted) for (const price of row.prices) {
    if (price.fraction === 1) priceCounts.FULL += 1;
    if (price.fraction === 0.5) priceCounts.HALF += 1;
    if (price.fraction === 0.25) priceCounts.QUARTER += 1;
  }
  const hasPrice = (row, fraction) => row.prices.some((price) => price.fraction === fraction);
  const priceCombinations = {
    fullAndHalf: accepted.filter((row) => hasPrice(row, 1) && hasPrice(row, 0.5)).length,
    fullWithoutHalf: accepted.filter((row) => hasPrice(row, 1) && !hasPrice(row, 0.5)).length,
    halfWithoutFull: accepted.filter((row) => !hasPrice(row, 1) && hasPrice(row, 0.5)).length,
    quarterWithoutFull: accepted.filter((row) => !hasPrice(row, 1) && hasPrice(row, 0.25)).length,
    withoutFull: accepted.filter((row) => !hasPrice(row, 1)).length,
  };
  const dimensionRecovery = {
    normal: accepted.filter((row) => row.dimensionSource === "mapped_normal").length,
    jumbo: accepted.filter((row) => row.dimensionSource === "mapped_jumbo").length,
    superJumbo: accepted.filter((row) => row.dimensionSource === "mapped_super_jumbo").length,
    explicit: accepted.filter((row) => row.dimensionSource === "explicit").length,
    unresolved: accepted.filter((row) => row.dimensionSource === "unresolved").length,
  };
  const formatGroups = new Map();
  for (const row of candidates) {
    const key = formatIdentity(row);
    if (existingFormats.has(key)) continue;
    const group = formatGroups.get(key) || { lengthMm: row.lengthMm, widthMm: row.widthMm,
      thicknessMm: row.thicknessMm, commercialNames: new Set(), brands: new Set(), variantKeys: new Set() };
    if (row.commercialFormat) group.commercialNames.add(row.commercialFormat);
    group.brands.add(row.brand);
    group.variantKeys.add(row.variantKey);
    formatGroups.set(key, group);
  }
  const newFormatDetails = [...formatGroups.values()].map((group) => ({
    lengthMm: group.lengthMm,
    widthMm: group.widthMm,
    thicknessMm: group.thicknessMm,
    commercialNames: [...group.commercialNames].sort(),
    brands: [...group.brands].sort(),
    variants: group.variantKeys.size,
  }));
  return {
    database: state.database,
    source: analysis.sourceFile,
    totalRows: analysis.allRows.length,
    quartzFound: accepted.filter((row) => row.category === "quartz").length,
    graniteFound: accepted.filter((row) => row.category === "granite").length,
    skippedOtherCategories: analysis.allRows.length - accepted.length,
    validCandidates: candidates.length,
    rejectedRows: accepted.filter((row) => row.errors.length).length,
    errorCount: accepted.reduce((sum, row) => sum + row.errors.length, 0),
    warningRows: accepted.filter((row) => row.warnings.length).length,
    warningCount: accepted.reduce((sum, row) => sum + row.warnings.length, 0),
    newMaterials: candidateMaterialKeys.size - updatingMaterials,
    updatingMaterials,
    newBrands: brands.filter((brand) => !currentBrands.has(brand)).length,
    newFormats: [...uniqueCandidateFormats].filter((key) => !existingFormats.has(key)).length,
    newPrices: candidates.reduce((sum, row) => sum + row.prices.length, 0),
    uniqueMaterials: candidateMaterialKeys.size,
    uniqueVariants: new Set(candidates.map((row) => row.variantKey)).size,
    uniquePrices: new Set(candidates.flatMap((row) => row.prices.map((price) => price.fingerprint))).size,
    discontinued: accepted.filter((row) => row.discontinued).length,
    rowsWithoutDimensions: accepted.filter((row) => !row.lengthMm || !row.widthMm).length,
    rowsWithoutThickness: accepted.filter((row) => !row.thicknessMm).length,
    rowsWithoutName: accepted.filter((row) => !row.name).length,
    rowsWithoutPrices: accepted.filter((row) => row.prices.length === 0).length,
    duplicateCandidates: analysis.duplicateCandidates,
    brands,
    dimensions,
    currencies,
    priceCounts,
    priceCombinations,
    dimensionRecovery,
    newFormatDetails,
    suspiciousPriceRows: accepted.filter((row) => row.warnings.some((warning) => warning.includes("suspicious_half_price"))).length,
    articleNameConflictGroups: analysis.articleNameConflicts.length,
    variantSchemaReady: state.variantSchemaReady,
  };
}

function displayRow(row) {
  if (!row) return "не найден";
  return JSON.stringify({
    row: row.sourceRow,
    category: row.category,
    brand: row.brand,
    article: row.article,
    materialId: `imp-${row.materialKey.slice(0, 32)}`,
    sourceName: row.sourceName,
    name: row.name,
    commercialFormat: row.commercialFormat,
    dimensions: row.lengthMm && row.widthMm ? `${row.lengthMm}×${row.widthMm}×${row.thicknessMm || "?"}` : null,
    surface: row.surface,
    dimensionSource: row.dimensionSource,
    prices: row.prices.map((price) => ({ fraction: price.fraction, amountMinor: price.amountMinor, currency: price.currency })),
    discontinued: row.discontinued,
    errors: row.errors,
    warnings: row.warnings,
    sourceLocation: row.sourceLocation,
  }, null, 2);
}

function buildReport(analysis, summary) {
  const accepted = analysis.acceptedCategories;
  const stratos = accepted.find((row) => row.brand === "Stratos");
  const belencoPair = accepted.filter((row) => row.brand === "Belenco" && row.article === "1010");
  const aizano = accepted.find((row) => row.brand === "Belenco" && row.article === "4043" && row.name === "Aizano");
  const noblle = accepted.find((row) => row.brand === "Noblle" && row.article === "Q840");
  const noblleNeighbors = accepted.filter((row) => row.brand === "Noblle" && noblle && Math.abs(row.sourceRow - noblle.sourceRow) <= 2);
  const caesarstone = accepted.find((row) => row.brand === "Caesarstone" && row.lengthMm === 3340 && row.widthMm === 1640);
  const unequalHalf = accepted.find((row) => row.brand === "Belenco" && row.name === "Aizano" &&
    row.prices.find((price) => price.fraction === 1)?.amountMinor === 61000 &&
    row.prices.find((price) => price.fraction === 0.5)?.amountMinor === 31500) || accepted.find((row) => {
    const full = row.prices.find((price) => price.fraction === 1)?.amountMinor;
    const half = row.prices.find((price) => price.fraction === 0.5)?.amountMinor;
    return full !== undefined && half !== undefined && full !== half * 2;
  });
  const missingNames = accepted.filter((row) => !row.name);
  const halfWithoutFull = accepted.filter((row) =>
    !row.prices.some((price) => price.fraction === 1) && row.prices.some((price) => price.fraction === 0.5),
  );
  const suspiciousPrices = accepted.filter((row) => row.warnings.some((warning) => warning.includes("suspicious_half_price")));
  const conflicts = accepted.filter((row) => row.warnings.includes("ARTICLE_NAME_CONFLICT"));

  return `# Material import dry-run report

- Источник: ${summary.source}
- Дата: ${new Date().toISOString()}
- База проверки: ${summary.database}
- Режим: dry-run, записей в БД нет
- Миграция 007 применена: ${summary.variantSchemaReady ? "да" : "нет"}

## OLD vs NEW

| Метрика | Dry-run №1 | Dry-run №2 |
|---|---:|---:|
| validCandidates | 122 | ${summary.validCandidates} |
| rejectedRows | 239 | ${summary.rejectedRows} |
| rowsWithoutDimensions | 237 | ${summary.rowsWithoutDimensions} |

## Текущая статистика

- Всего строк данных: ${summary.totalRows}
- Кварцевый агломерат: ${summary.quartzFound}
- Натуральный гранит: ${summary.graniteFound}
- Пропущено других категорий: ${summary.skippedOtherCategories}
- Валидных кандидатов: ${summary.validCandidates}
- Отклонено строк / отдельных ошибок: ${summary.rejectedRows} / ${summary.errorCount}
- Строк с предупреждениями / предупреждений: ${summary.warningRows} / ${summary.warningCount}
- Новых материалов: ${summary.newMaterials}
- Обновляемых материалов: ${summary.updatingMaterials}
- Новых брендов: ${summary.newBrands}
- Новых форматов: ${summary.newFormats}
- Новых ценовых записей: ${summary.newPrices}
- Уникальных materials / variants / prices: ${summary.uniqueMaterials} / ${summary.uniqueVariants} / ${summary.uniquePrices}
- OUT/discontinued: ${summary.discontinued}
- Без физических размеров: ${summary.rowsWithoutDimensions}
- Без толщины: ${summary.rowsWithoutThickness}
- Без чистого имени: ${summary.rowsWithoutName}
- Без цены: ${summary.rowsWithoutPrices}
- Duplicate candidates: ${summary.duplicateCandidates}
- FULL/HALF/QUARTER: ${summary.priceCounts.FULL}/${summary.priceCounts.HALF}/${summary.priceCounts.QUARTER}
- FULL+HALF: ${summary.priceCombinations.fullAndHalf}
- FULL без HALF: ${summary.priceCombinations.fullWithoutHalf}
- HALF без FULL: ${summary.priceCombinations.halfWithoutFull}
- QUARTER без FULL: ${summary.priceCombinations.quarterWithoutFull}
- Без FULL: ${summary.priceCombinations.withoutFull}

## Нормализация размеров

- NORMAL/НОРМАЛ → 3050×1440: ${summary.dimensionRecovery.normal}
- JUMBO → 3200×1600: ${summary.dimensionRecovery.jumbo}
- SUPER JUMBO → 3300×1650: ${summary.dimensionRecovery.superJumbo}
- Явные физические размеры: ${summary.dimensionRecovery.explicit}
- Всё ещё без размера: ${summary.dimensionRecovery.unresolved}

Одиночные числа не считаются форматом слэба.

## Новые форматы

\`\`\`json
${JSON.stringify(summary.newFormatDetails, null, 2)}
\`\`\`

## Справочники источника

- Бренды: ${summary.brands.join(", ")}
- Валюты: ${summary.currencies.join(", ")}
- Размеры/обозначения: ${summary.dimensions.join(", ")}

## Примеры

### Stratos

\`\`\`json
${displayRow(stratos)}
\`\`\`

### Belenco NORMAL/JUMBO

${belencoPair.map((row) => `\`\`\`json\n${displayRow(row)}\n\`\`\``).join("\n\n") || "не найдено"}

### Noblle Q840 White Misterio

\`\`\`json
${displayRow(noblle)}
\`\`\`

Исходные колонки Q840:

\`\`\`json
${JSON.stringify(noblle?.sourceValues || null, null, 2)}
\`\`\`

Соседние строки Noblle:

${noblleNeighbors.map((row) => `\`\`\`json\n${JSON.stringify(row.sourceValues, null, 2)}\n\`\`\``).join("\n\n")}

Значение 26 попало в HALF без вычислений: это непосредственное значение ячейки колонки \`Цена 1/2\`.

### Belenco Aizano

\`\`\`json
${displayRow(aizano)}
\`\`\`

### Caesarstone 3340×1640

\`\`\`json
${displayRow(caesarstone)}
\`\`\`

### FULL/HALF не 50%

\`\`\`json
${displayRow(unequalHalf)}
\`\`\`

## HALF без FULL — первые 20

${halfWithoutFull.slice(0, 20).map((row) => `- ${displayRow(row)}`).join("\n") || "Нет."}

## Suspicious prices

${suspiciousPrices.map((row) => `- Строка ${row.sourceRow}: ${row.brand} ${row.article} ${row.sourceName} — ${row.warnings.join("; ")}`).join("\n") || "Нет."}

## ARTICLE_NAME_CONFLICT

Групп: ${summary.articleNameConflictGroups}

${conflicts.map((row) => `- Строка ${row.sourceRow}: ${row.brand} ${row.article}: source=${JSON.stringify(row.sourceName)}, clean=${JSON.stringify(row.name)}, materialId=imp-${row.materialKey.slice(0, 32)}`).join("\n") || "Нет."}

## Все строки без наименования

${missingNames.map((row) => `### Строка ${row.sourceRow}\n\nПричина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.\n\n\`\`\`json\n${JSON.stringify(row.sourceValues, null, 2)}\n\`\`\``).join("\n\n") || "Нет."}

## Оставшиеся причины reject

- Нет чистого наименования: ${summary.rowsWithoutName}
- Нет однозначных физических размеров: ${summary.rowsWithoutDimensions}
- Нет толщины: ${summary.rowsWithoutThickness}

## Важные замечания

- Цена 1/4 сохраняется моделью, но automatic slab calculator продолжает работать с шагом 0.5.
- EUR не трактуется как USD. Для реального импорта и выбора EUR-цены калькулятором нужен явный \`--eur-per-usd\` и дата курса.
- NORMAL/НОРМАЛ, JUMBO и SUPER JUMBO нормализуются по утверждённому business mapping; явные размеры всегда имеют приоритет.
- В исходном XLSX у части строк полная цена фактически находится в числовой ячейке «Поверхность» при пустой «Цена»; dry-run восстанавливает её с предупреждением и не выдумывает поверхность.
- Натуральный гранит отсутствует и не импортируется по словам Granite внутри названий других категорий.
`;
}

async function resolveFormat(connection, row) {
  const [[existing]] = await connection.query(
    `SELECT format_id FROM calculator_slab_formats
     WHERE length_mm = ? AND width_mm = ? AND thickness_mm = ? LIMIT 1`,
    [row.lengthMm, row.widthMm, row.thicknessMm],
  );
  if (existing) return existing.format_id;
  const systemCode = `source_${row.lengthMm}x${row.widthMm}x${row.thicknessMm}`.slice(0, 40);
  const [result] = await connection.query(
    `INSERT INTO calculator_slab_formats
     (system_code, display_name, length_mm, width_mm, thickness_mm, is_custom, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, 0, 1, 100)
     ON DUPLICATE KEY UPDATE format_id = LAST_INSERT_ID(format_id)`,
    [systemCode, `${row.lengthMm}×${row.widthMm}×${row.thicknessMm}`, row.lengthMm, row.widthMm, row.thicknessMm],
  );
  return result.insertId;
}

async function writeImport(connection, analysis, options) {
  if (process.env.ALLOW_MATERIAL_IMPORT !== "1") {
    throw new Error("Для реального импорта установите ALLOW_MATERIAL_IMPORT=1 после проверки dry-run");
  }
  await connection.beginTransaction();
  try {
    for (const row of analysis.candidates) {
      const materialId = `imp-${row.materialKey.slice(0, 32)}`;
      const formatId = await resolveFormat(connection, row);
      const decision = calculatorPriceDecision(row, options);
      const activeFull = row.prices.find((price) => price.fraction === 1);
      const calculatorFull = activeFull ? decision.calculatorAmountUsdCents(activeFull) : null;
      await connection.query(
        `INSERT INTO materials
         (material_id, type_id, title, fabricator, sku, article, import_key, price_per_m2,
          slab_format_id, length_mm, width_mm, thickness_mm, price_unit, base_price_usd_cents,
          is_active, is_discontinued, public_available, sort_order, price_changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'slab', ?, 1, ?, 0, 100, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE fabricator=VALUES(fabricator), sku=VALUES(sku),
          article=VALUES(article), type_id=VALUES(type_id),
          is_discontinued=(is_discontinued AND VALUES(is_discontinued)),
          slab_format_id=IF(base_price_usd_cents=0 AND VALUES(base_price_usd_cents)>0, VALUES(slab_format_id), slab_format_id),
          length_mm=IF(base_price_usd_cents=0 AND VALUES(base_price_usd_cents)>0, VALUES(length_mm), length_mm),
          width_mm=IF(base_price_usd_cents=0 AND VALUES(base_price_usd_cents)>0, VALUES(width_mm), width_mm),
          thickness_mm=IF(base_price_usd_cents=0 AND VALUES(base_price_usd_cents)>0, VALUES(thickness_mm), thickness_mm),
          base_price_usd_cents=IF(base_price_usd_cents=0, VALUES(base_price_usd_cents), base_price_usd_cents),
          title=IF(CHAR_LENGTH(VALUES(title)) < CHAR_LENGTH(title), VALUES(title), title)`,
        [materialId, row.category, `${row.article ? `${row.article} ` : ""}${row.name}`.slice(0, 100), row.brand,
          row.article || null, row.article || null, row.materialKey, formatId, row.lengthMm, row.widthMm,
          row.thicknessMm, calculatorFull || 0, row.discontinued ? 1 : 0],
      );
      await connection.query(
        `INSERT INTO material_variants
         (material_id, slab_format_id, variant_key, commercial_format, source_name, length_mm, width_mm,
          thickness_mm, surface, source_note, is_discontinued, is_calculator_ready, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE material_variant_id=LAST_INSERT_ID(material_variant_id), slab_format_id=VALUES(slab_format_id),
          commercial_format=VALUES(commercial_format), source_name=VALUES(source_name), surface=VALUES(surface),
          source_note=VALUES(source_note), is_discontinued=VALUES(is_discontinued),
          is_calculator_ready=VALUES(is_calculator_ready), is_active=1`,
        [materialId, formatId, row.variantKey, row.commercialFormat, row.sourceName, row.lengthMm, row.widthMm,
          row.thicknessMm, row.surface, row.note || null, row.discontinued ? 1 : 0,
          decision.calculatorReady ? 1 : 0],
      );
      const variantId = (await connection.query("SELECT material_variant_id FROM material_variants WHERE variant_key = ?", [row.variantKey]))[0][0].material_variant_id;
      for (const price of row.prices) {
        const calculatorUsd = decision.calculatorAmountUsdCents(price);
        const isCalculatorPrice = decision.isCalculatorPrice(price);
        await connection.query(
          `UPDATE material_prices SET is_active=0, is_calculator_price=0, valid_to=CURRENT_TIMESTAMP
           WHERE material_variant_id=? AND quantity_fraction=? AND source_currency=?
             AND COALESCE(price_type,'')=? AND source_file=? AND source_fingerprint<>? AND is_active=1`,
          [variantId, price.fraction, price.currency, row.priceType, analysis.sourceFile, price.fingerprint],
        );
        await connection.query(
          `INSERT INTO material_prices
           (material_variant_id, source_fingerprint, quantity_fraction, source_amount_minor, source_currency,
            calculator_amount_usd_cents, import_exchange_rate, exchange_rate_date, unit, price_type, vat_info,
            source_file, source_location, is_calculator_price, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE is_active=1, valid_to=NULL, updated_at=CURRENT_TIMESTAMP`,
          [variantId, price.fingerprint, price.fraction, price.amountMinor, price.currency, calculatorUsd,
            price.currency === "USD" ? 1 : null, price.currency === "USD" ? options.exchangeRateDate : null, row.unit || null,
            row.priceType || null, row.vatInfo || null, analysis.sourceFile, row.sourceLocation || null,
            isCalculatorPrice ? 1 : 0],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const analysis = analyzeWorkbook(options.filePath);
  const connection = await pool.getConnection();
  try {
    const state = await currentState(connection);
    const summary = buildSummary(analysis, state);
    if (options.dryRun) {
      const reportPath = path.resolve(__dirname, "..", "..", "MATERIAL_IMPORT_REPORT.md");
      fs.writeFileSync(reportPath, buildReport(analysis, summary), "utf8");
      console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
      return summary;
    }
    if (!state.variantSchemaReady) throw new Error("Сначала примените migration 007");
    await writeImport(connection, analysis, options);
    return summary;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  }).finally(() => pool.end());
}

module.exports = { parseArguments, currentState, buildSummary, buildReport, run, writeImport };
