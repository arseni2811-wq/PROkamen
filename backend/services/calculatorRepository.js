const pool = require("../db");

function mapMaterial(row) {
  return {
    id: row.material_id,
    category: row.type_id,
    manufacturer: row.fabricator,
    series: row.series_name,
    title: row.title,
    sku: row.sku,
    description: row.description,
    image: row.image_path,
    color: row.color,
    priceUnit: row.price_unit,
    basePriceUsdCents: Number(row.base_price_usd_cents || 0),
    markupBps: Number(row.markup_bps || 0),
    publicAvailable: Boolean(row.public_available),
    active: Boolean(row.is_active),
    importKey: row.import_key || null,
    slabFormatId: row.slab_format_id,
    lengthMm: row.length_mm === null ? null : Number(row.length_mm),
    widthMm: row.width_mm === null ? null : Number(row.width_mm),
    thicknessMm: row.thickness_mm === null ? null : Number(row.thickness_mm),
    fractionPricesUsdCents: row.fraction_prices_usd_cents || null,
  };
}

function validationError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function getRequiredFractionPrices(priceRows, exchangeRates = {}) {
  const grouped = new Map();
  for (const row of priceRows) {
    const currency = row.source_currency;
    const key = `${currency}:${String(Number(row.quantity_fraction))}`;
    const entries = grouped.get(key) || [];
    entries.push(row);
    grouped.set(key, entries);
  }
  const currencies = [...new Set(priceRows.map((row) => row.source_currency))];
  const candidates = currencies.filter((currency) => {
    const full = grouped.get(`${currency}:1`) || [];
    const half = grouped.get(`${currency}:0.5`) || [];
    return full.length === 1 && half.length === 1 && exchangeRates[currency];
  });
  if (candidates.length !== 1) {
    throw validationError("Для выбранного варианта нет однозначной пары FULL/HALF в валюте с прямым курсом BYN");
  }
  const currency = candidates[0];
  const full = grouped.get(`${currency}:1`);
  const half = grouped.get(`${currency}:0.5`);
  return {
    currency,
    fullMinor: Number(full[0].source_amount_minor),
    halfMinor: Number(half[0].source_amount_minor),
    exchangeRateToBynScaled: Number(exchangeRates[currency].bynPerUnitScaled),
    exchangeRateDate: exchangeRates[currency].rateDate || null,
  };
}

async function getMaterialVariantForCalculator(materialId, materialVariantId, slabFormatCode, exchangeRates) {
  if (!materialVariantId) {
    throw validationError("Для импортированного материала необходимо выбрать вариант");
  }
  const [[variant]] = await pool.query(
    `SELECT v.*, f.system_code AS slab_format_code, f.display_name AS slab_format_name,
            f.is_custom AS slab_format_custom
     FROM material_variants v
     JOIN calculator_slab_formats f ON f.format_id = v.slab_format_id AND f.is_active = 1
     WHERE v.material_variant_id = ? AND v.material_id = ? AND v.is_active = 1
     LIMIT 1`,
    [materialVariantId, materialId],
  );
  if (!variant) {
    throw validationError("Выбранный вариант не принадлежит материалу или недоступен");
  }
  if (!variant.is_calculator_ready) {
    throw validationError("Выбранный вариант недоступен для автоматического расчёта");
  }
  if (slabFormatCode && slabFormatCode !== variant.slab_format_code) {
    throw validationError("Формат слэба не соответствует выбранному варианту");
  }
  const [prices] = await pool.query(
    `SELECT quantity_fraction, source_amount_minor, source_currency
     FROM material_prices
     WHERE material_variant_id = ? AND is_active = 1 AND is_calculator_price = 1
       AND quantity_fraction IN (1.00, 0.50)`,
    [variant.material_variant_id],
  );
  return { ...variant, sourcePrices: getRequiredFractionPrices(prices, exchangeRates) };
}

function mapFormat(row, custom = {}) {
  return {
    id: Number(row.format_id),
    code: row.system_code,
    name: row.display_name,
    lengthMm: row.is_custom ? Number(custom.lengthMm) : Number(row.length_mm),
    widthMm: row.is_custom ? Number(custom.widthMm) : Number(row.width_mm),
    thicknessMm: row.is_custom
      ? Number(custom.thicknessMm || 20)
      : Number(row.thickness_mm),
    custom: Boolean(row.is_custom),
  };
}

function mapRate(row) {
  return {
    id: Number(row.rate_id),
    systemCode: row.system_code,
    displayName: row.display_name,
    category: row.category,
    unit: row.unit_code,
    basePriceUsdCents: Number(row.base_price_usd_cents),
    calculationMode: row.calculation_mode,
    dependentCode: row.dependent_code,
    percentBps: row.percent_bps === null ? null : Number(row.percent_bps),
    publicAvailable: Boolean(row.public_available),
    managerAvailable: Boolean(row.manager_available),
    manualAdjustmentAllowed: Boolean(row.manual_adjustment_allowed),
    active: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
  };
}

async function getPublishedPricebook({ materialId, materialVariantId, slabFormatCode, customFormat, publicMode = false }) {
  const [[pricebook]] = await pool.query(
    `SELECT p.*, s.reserve_bps, s.public_factor_bps,
            s.minimum_order_byn_cents, s.rounding_step_byn_cents,
            s.waste_bps, s.minimum_material_markup_bps, s.public_wording
     FROM calculator_pricebooks p
     JOIN calculator_settings s ON s.pricebook_id = p.pricebook_id
     WHERE p.status = 'published'
     ORDER BY p.version_number DESC LIMIT 1`,
  );
  if (!pricebook) return null;
  const [exchangeRateRows] = await pool.query(
    "SELECT currency_code, byn_per_unit_scaled, rate_date FROM calculator_exchange_rates WHERE pricebook_id = ?",
    [pricebook.pricebook_id],
  );
  const exchangeRates = Object.fromEntries(exchangeRateRows.map((row) => [row.currency_code, {
    bynPerUnitScaled: Number(row.byn_per_unit_scaled), rateDate: row.rate_date,
  }]));

  const materialConditions = publicMode
    ? "AND m.is_active = 1 AND m.public_available = 1 AND m.type_id IN ('quartz','granite','onyx')"
    : "AND m.is_active = 1";
  const [[materialRow]] = await pool.query(
    `SELECT m.* FROM materials m WHERE m.material_id = ? ${materialConditions} LIMIT 1`,
    [materialId],
  );
  if (!materialRow) return null;
  const imported = Boolean(materialRow.import_key);
  const variant = imported
    ? await getMaterialVariantForCalculator(materialRow.material_id, materialVariantId, slabFormatCode, exchangeRates)
    : null;
  const formatCode = imported ? variant.slab_format_code : slabFormatCode || null;
  const [[formatRow]] = formatCode
    ? await pool.query(
        "SELECT * FROM calculator_slab_formats WHERE system_code = ? AND is_active = 1 LIMIT 1",
        [formatCode],
      )
    : await pool.query(
        `SELECT f.* FROM calculator_slab_formats f
         WHERE f.format_id = ? AND f.is_active = 1 LIMIT 1`,
        [materialRow.slab_format_id],
      );
  if (!formatRow) return null;
  const mappedMaterial = mapMaterial(materialRow);
  if (imported) {
    mappedMaterial.priceUnit = "slab";
    mappedMaterial.sourceCurrency = variant.sourcePrices.currency;
    mappedMaterial.fractionPricesMinor = { "1": variant.sourcePrices.fullMinor, "0.5": variant.sourcePrices.halfMinor };
    mappedMaterial.materialVariantId = Number(variant.material_variant_id);
    mappedMaterial.commercialFormat = variant.commercial_format || null;
    mappedMaterial.surface = variant.surface || null;
    mappedMaterial.lengthMm = Number(variant.length_mm);
    mappedMaterial.widthMm = Number(variant.width_mm);
    mappedMaterial.thicknessMm = Number(variant.thickness_mm);
  }

  const [rateRows] = await pool.query(
    `SELECT * FROM calculator_rates
     WHERE pricebook_id = ? AND is_active = 1
       ${publicMode ? "AND public_available = 1" : "AND manager_available = 1"}
     ORDER BY sort_order, rate_id`,
    [pricebook.pricebook_id],
  );
  return {
    id: Number(pricebook.pricebook_id),
    version: Number(pricebook.version_number),
    exchangeRateScaled: Number(pricebook.exchange_rate_scaled),
    exchangeRates,
    publicWording: pricebook.public_wording,
    material: mappedMaterial,
    slabFormat: mapFormat(formatRow, customFormat),
    rates: rateRows.map(mapRate),
    settings: {
      reserveBps: Number(pricebook.reserve_bps),
      publicFactorBps: Number(pricebook.public_factor_bps),
      minimumOrderBynCents: Number(pricebook.minimum_order_byn_cents),
      roundingStepBynCents: Number(pricebook.rounding_step_byn_cents),
      wasteBps: Number(pricebook.waste_bps),
      minimumMaterialMarkupBps: Number(pricebook.minimum_material_markup_bps),
    },
  };
}

async function getPublicCatalog() {
  const [categories] = await pool.query(
    `SELECT type_id AS id, type_name_ru AS name
     FROM dict_material_types
     WHERE is_active = 1 AND public_available = 1
       AND type_id IN ('quartz','granite','onyx')
     ORDER BY sort_order, type_name_ru`,
  );
  const [materials] = await pool.query(
    `SELECT material_id AS id, type_id AS category, fabricator AS manufacturer,
            series_name AS series, title, sku, description, image_path AS image,
            color, slab_format_id AS slabFormatId, thickness_mm AS thicknessMm
     FROM materials
     WHERE is_active = 1 AND public_available = 1
       AND type_id IN ('quartz','granite','onyx')
       AND base_price_usd_cents > 0
     ORDER BY sort_order, title`,
  );
  const [formats] = await pool.query(
    `SELECT format_id AS id, system_code AS code, display_name AS name,
            length_mm AS lengthMm, width_mm AS widthMm,
            thickness_mm AS thicknessMm, is_custom AS custom
     FROM calculator_slab_formats WHERE is_active = 1 ORDER BY sort_order`,
  );
  const [operations] = await pool.query(
    `SELECT r.system_code AS code, r.display_name AS name,
            r.category, r.unit_code AS unit
     FROM calculator_rates r
     JOIN calculator_pricebooks p ON p.pricebook_id = r.pricebook_id
     WHERE p.status = 'published' AND r.is_active = 1
       AND r.public_available = 1
     ORDER BY r.sort_order, r.rate_id`,
  );
  return { categories, materials, formats, operations };
}

async function getInternalCatalog() {
  const [categories] = await pool.query(
    `SELECT type_id AS id, type_name_ru AS name
     FROM dict_material_types WHERE is_active = 1
     ORDER BY sort_order, type_name_ru`,
  );
  const [materials] = await pool.query(
    `SELECT material_id AS id, type_id AS category, fabricator AS manufacturer,
            series_name AS series, title, sku, description, image_path AS image,
            color, slab_format_id AS slabFormatId, thickness_mm AS thicknessMm,
            import_key AS importKey
     FROM materials WHERE is_active = 1
     ORDER BY sort_order, title`,
  );
  const [variantRows] = await pool.query(
    `SELECT v.material_variant_id AS materialVariantId, v.material_id AS materialId,
            v.slab_format_id AS slabFormatId, f.system_code AS slabFormatCode,
            v.commercial_format AS commercialFormat, v.length_mm AS lengthMm,
            v.width_mm AS widthMm, v.thickness_mm AS thicknessMm, v.surface,
            v.is_calculator_ready AS isCalculatorReady, v.is_discontinued AS isDiscontinued
     FROM material_variants v
     JOIN materials m ON m.material_id = v.material_id AND m.import_key IS NOT NULL
     LEFT JOIN calculator_slab_formats f ON f.format_id = v.slab_format_id
     WHERE v.is_active = 1
     ORDER BY v.material_id, v.material_variant_id`,
  );
  const [priceRows] = await pool.query(
    `SELECT material_variant_id AS materialVariantId, quantity_fraction AS quantityFraction,
            source_currency AS sourceCurrency, source_amount_minor AS sourceAmountMinor
     FROM material_prices
     WHERE is_active = 1
       AND quantity_fraction IN (1.00, 0.50)`,
  );
  const [publishedRates] = await pool.query(
    `SELECT e.currency_code AS currencyCode, e.byn_per_unit_scaled AS bynPerUnitScaled
     FROM calculator_exchange_rates e
     JOIN calculator_pricebooks p ON p.pricebook_id = e.pricebook_id
     WHERE p.status = 'published'`,
  );
  const publishedRateMap = Object.fromEntries(publishedRates.map((rate) => [rate.currencyCode, { bynPerUnitScaled: rate.bynPerUnitScaled }]));
  const pricesByVariant = new Map();
  for (const price of priceRows) {
    const id = Number(price.materialVariantId);
    const availability = pricesByVariant.get(id) || [];
    availability.push({ quantity_fraction: price.quantityFraction, source_currency: price.sourceCurrency, source_amount_minor: price.sourceAmountMinor });
    pricesByVariant.set(id, availability);
  }
  const variantsByMaterial = new Map();
  for (const variant of variantRows) {
    const materialId = variant.materialId;
    const variants = variantsByMaterial.get(materialId) || [];
    const sourcePrices = pricesByVariant.get(Number(variant.materialVariantId)) || [];
    let resolved = null;
    try { resolved = getRequiredFractionPrices(sourcePrices, publishedRateMap); } catch (_) { /* not available */ }
    variants.push({
      ...variant,
      materialVariantId: Number(variant.materialVariantId),
      isCalculatorReady: Boolean(resolved),
      isDiscontinued: Boolean(variant.isDiscontinued),
      pricesAvailable: {
        full: sourcePrices.some((price) => Number(price.quantity_fraction) === 1),
        half: sourcePrices.some((price) => Number(price.quantity_fraction) === 0.5),
      },
    });
    variantsByMaterial.set(materialId, variants);
  }
  const [formats] = await pool.query(
    `SELECT format_id AS id, system_code AS code, display_name AS name,
            length_mm AS lengthMm, width_mm AS widthMm,
            thickness_mm AS thicknessMm, is_custom AS custom
     FROM calculator_slab_formats WHERE is_active = 1 ORDER BY sort_order`,
  );
  const [operations] = await pool.query(
    `SELECT r.system_code AS code, r.display_name AS name,
            r.category, r.unit_code AS unit
     FROM calculator_rates r
     JOIN calculator_pricebooks p ON p.pricebook_id = r.pricebook_id
     WHERE p.status = 'published' AND r.is_active = 1
       AND r.manager_available = 1
     ORDER BY r.sort_order, r.rate_id`,
  );
  return {
    categories,
    materials: materials.map((material) => ({
      ...material,
      imported: Boolean(material.importKey),
      variants: variantsByMaterial.get(material.id) || [],
    })),
    formats,
    operations: operations
      .filter((item) => !["manual_polish_small", "manual_polish_large"].includes(item.code))
      .concat({
        code: "manual_polish_area",
        name: "Ручная полировка площади",
        category: "production",
        unit: "service",
      }),
  };
}

async function getAdminPricebook() {
  const [[pricebook]] = await pool.query(
    `SELECT p.*, s.* FROM calculator_pricebooks p
     JOIN calculator_settings s ON s.pricebook_id = p.pricebook_id
     WHERE p.status IN ('draft','published')
     ORDER BY (p.status = 'draft') DESC, p.version_number DESC LIMIT 1`,
  );
  if (!pricebook) return null;
  const [rates] = await pool.query(
    "SELECT * FROM calculator_rates WHERE pricebook_id = ? ORDER BY sort_order, rate_id",
    [pricebook.pricebook_id],
  );
  const [materials] = await pool.query(
    "SELECT * FROM materials ORDER BY sort_order, title",
  );
  const [formats] = await pool.query(
    "SELECT * FROM calculator_slab_formats ORDER BY sort_order, format_id",
  );
  const [history] = await pool.query(
    `SELECT change_id AS id, entity_type AS entityType,
            entity_key AS entityKey, action, before_json AS beforeValue,
            after_json AS afterValue, created_at AS createdAt
     FROM calculator_change_history ORDER BY change_id DESC LIMIT 100`,
  );
  const [exchangeRates] = await pool.query(
    "SELECT currency_code AS currencyCode, byn_per_unit_scaled AS bynPerUnitScaled, rate_date AS rateDate FROM calculator_exchange_rates WHERE pricebook_id = ? ORDER BY currency_code",
    [pricebook.pricebook_id],
  );
  return { pricebook, exchangeRates, rates: rates.map(mapRate), materials: materials.map(mapMaterial), formats, history };
}

async function updateMaterial(actorId, materialId, changes) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[before]] = await connection.query(
      "SELECT * FROM materials WHERE material_id = ? FOR UPDATE",
      [materialId],
    );
    if (!before) throw Object.assign(new Error("Материал не найден"), { status: 404 });
    await connection.query(
      `UPDATE materials SET type_id = ?, fabricator = ?, series_name = ?,
       title = ?, sku = ?, description = ?, image_path = ?, color = ?,
       slab_format_id = ?, length_mm = ?, width_mm = ?, thickness_mm = ?,
       price_unit = ?, base_price_usd_cents = ?, markup_bps = ?,
       is_active = ?, public_available = ?, sort_order = ?,
       price_changed_at = CURRENT_TIMESTAMP WHERE material_id = ?`,
      [changes.category, changes.manufacturer, changes.series, changes.title,
       changes.sku, changes.description, changes.image, changes.color,
       changes.slabFormatId, changes.lengthMm, changes.widthMm,
       changes.thicknessMm, changes.priceUnit, changes.basePriceUsdCents,
       changes.markupBps, changes.active, changes.publicAvailable,
       changes.sortOrder, materialId],
    );
    await connection.query(
      `INSERT INTO calculator_change_history
       (actor_id, entity_type, entity_key, action, before_json, after_json)
       VALUES (?, 'material', ?, 'update', ?, ?)`,
      [actorId, materialId, JSON.stringify(before), JSON.stringify(changes)],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback(); throw error;
  } finally { connection.release(); }
}

async function updateSlabFormat(actorId, systemCode, changes) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[before]] = await connection.query(
      "SELECT * FROM calculator_slab_formats WHERE system_code = ? FOR UPDATE",
      [systemCode],
    );
    if (!before) throw Object.assign(new Error("Формат не найден"), { status: 404 });
    await connection.query(
      `UPDATE calculator_slab_formats SET display_name = ?, length_mm = ?,
       width_mm = ?, thickness_mm = ?, is_active = ?, sort_order = ?
       WHERE system_code = ?`,
      [changes.name, changes.lengthMm, changes.widthMm, changes.thicknessMm,
       changes.active, changes.sortOrder, systemCode],
    );
    await connection.query(
      `INSERT INTO calculator_change_history
       (actor_id, entity_type, entity_key, action, before_json, after_json)
       VALUES (?, 'slab_format', ?, 'update', ?, ?)`,
      [actorId, systemCode, JSON.stringify(before), JSON.stringify(changes)],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback(); throw error;
  } finally { connection.release(); }
}

async function ensureDraft(connection, actorId) {
  const [[draft]] = await connection.query(
    "SELECT pricebook_id, version_number FROM calculator_pricebooks WHERE status = 'draft' ORDER BY version_number DESC LIMIT 1 FOR UPDATE",
  );
  if (draft) return draft;
  const [[published]] = await connection.query(
    "SELECT * FROM calculator_pricebooks WHERE status = 'published' ORDER BY version_number DESC LIMIT 1 FOR UPDATE",
  );
  if (!published) throw new Error("Опубликованный прайс не найден");
  const [insert] = await connection.query(
    `INSERT INTO calculator_pricebooks
     (version_number, status, exchange_rate_scaled, note, created_by)
     VALUES (?, 'draft', ?, 'Черновик новой версии', ?)`,
    [Number(published.version_number) + 1, published.exchange_rate_scaled, actorId],
  );
  await connection.query(
    `INSERT INTO calculator_settings
     SELECT ?, reserve_bps, public_factor_bps, minimum_order_byn_cents,
            rounding_step_byn_cents, waste_bps, minimum_material_markup_bps,
            public_wording, CURRENT_TIMESTAMP
     FROM calculator_settings WHERE pricebook_id = ?`,
    [insert.insertId, published.pricebook_id],
  );
  await connection.query(
    `INSERT INTO calculator_exchange_rates (pricebook_id, currency_code, byn_per_unit_scaled, rate_date)
     SELECT ?, currency_code, byn_per_unit_scaled, rate_date
     FROM calculator_exchange_rates WHERE pricebook_id = ?`,
    [insert.insertId, published.pricebook_id],
  );
  await connection.query(
    `INSERT INTO calculator_rates
     (pricebook_id, system_code, display_name, category, unit_code,
      base_price_usd_cents, calculation_mode, dependent_code, percent_bps,
      public_available, manager_available, manual_adjustment_allowed,
      is_active, sort_order)
     SELECT ?, system_code, display_name, category, unit_code,
            base_price_usd_cents, calculation_mode, dependent_code, percent_bps,
            public_available, manager_available, manual_adjustment_allowed,
            is_active, sort_order
     FROM calculator_rates WHERE pricebook_id = ?`,
    [insert.insertId, published.pricebook_id],
  );
  return { pricebook_id: insert.insertId, version_number: Number(published.version_number) + 1 };
}

async function updateDraftRate(actorId, systemCode, changes) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const draft = await ensureDraft(connection, actorId);
    const [[before]] = await connection.query(
      "SELECT * FROM calculator_rates WHERE pricebook_id = ? AND system_code = ? FOR UPDATE",
      [draft.pricebook_id, systemCode],
    );
    if (!before) throw Object.assign(new Error("Тариф не найден"), { status: 404 });
    await connection.query(
      `UPDATE calculator_rates SET display_name = ?, base_price_usd_cents = ?,
       public_available = ?, manager_available = ?,
       manual_adjustment_allowed = ?, is_active = ?
       WHERE pricebook_id = ? AND system_code = ?`,
      [changes.displayName, changes.basePriceUsdCents, changes.publicAvailable,
       changes.managerAvailable, changes.manualAdjustmentAllowed, changes.active,
       draft.pricebook_id, systemCode],
    );
    await connection.query(
      `INSERT INTO calculator_change_history
       (pricebook_id, actor_id, entity_type, entity_key, action, before_json, after_json)
       VALUES (?, ?, 'rate', ?, 'update', ?, ?)`,
      [draft.pricebook_id, actorId, systemCode, JSON.stringify(before), JSON.stringify(changes)],
    );
    await connection.commit();
    return draft;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateDraftSettings(actorId, changes) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const draft = await ensureDraft(connection, actorId);
    await connection.query(
      `UPDATE calculator_pricebooks SET exchange_rate_scaled = ? WHERE pricebook_id = ?`,
      [changes.exchangeRateScaled, draft.pricebook_id],
    );
    for (const [currencyCode, rate] of Object.entries(changes.exchangeRates || {})) {
      const [[before]] = await connection.query(
        "SELECT * FROM calculator_exchange_rates WHERE pricebook_id = ? AND currency_code = ? FOR UPDATE",
        [draft.pricebook_id, currencyCode],
      );
      await connection.query(
        `INSERT INTO calculator_exchange_rates (pricebook_id, currency_code, byn_per_unit_scaled, rate_date)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE byn_per_unit_scaled = VALUES(byn_per_unit_scaled), rate_date = VALUES(rate_date)`,
        [draft.pricebook_id, currencyCode, rate.bynPerUnitScaled, rate.rateDate || null],
      );
      await connection.query(
        `INSERT INTO calculator_change_history
         (pricebook_id, actor_id, entity_type, entity_key, action, before_json, after_json)
         VALUES (?, ?, 'exchange_rate', ?, 'update', ?, ?)`,
        [draft.pricebook_id, actorId, currencyCode, JSON.stringify(before || null), JSON.stringify(rate)],
      );
    }
    await connection.query(
      `UPDATE calculator_settings SET reserve_bps = ?, public_factor_bps = ?,
       minimum_order_byn_cents = ?, rounding_step_byn_cents = ?, waste_bps = ?,
       minimum_material_markup_bps = ?, public_wording = ? WHERE pricebook_id = ?`,
      [changes.reserveBps, changes.publicFactorBps, changes.minimumOrderBynCents,
       changes.roundingStepBynCents, changes.wasteBps,
       changes.minimumMaterialMarkupBps, changes.publicWording, draft.pricebook_id],
    );
    await connection.query(
      `INSERT INTO calculator_change_history
       (pricebook_id, actor_id, entity_type, entity_key, action, after_json)
       VALUES (?, ?, 'settings', 'calculator', 'update', ?)`,
      [draft.pricebook_id, actorId, JSON.stringify(changes)],
    );
    await connection.commit();
    return draft;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function publishDraft(actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[draft]] = await connection.query(
      "SELECT * FROM calculator_pricebooks WHERE status = 'draft' ORDER BY version_number DESC LIMIT 1 FOR UPDATE",
    );
    if (!draft) throw Object.assign(new Error("Черновик прайса отсутствует"), { status: 409 });
    await connection.query("UPDATE calculator_pricebooks SET status = 'archived' WHERE status = 'published'");
    await connection.query(
      "UPDATE calculator_pricebooks SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE pricebook_id = ?",
      [draft.pricebook_id],
    );
    await connection.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('exchange_rate', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [Number(draft.exchange_rate_scaled) / 10000],
    );
    await connection.query(
      `INSERT INTO calculator_change_history
       (pricebook_id, actor_id, entity_type, entity_key, action)
       VALUES (?, ?, 'pricebook', ?, 'publish')`,
      [draft.pricebook_id, actorId, String(draft.version_number)],
    );
    await connection.commit();
    return { version: Number(draft.version_number) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getRequiredFractionPrices,
  getMaterialVariantForCalculator,
  getPublishedPricebook,
  getPublicCatalog,
  getInternalCatalog,
  getAdminPricebook,
  updateMaterial,
  updateSlabFormat,
  updateDraftRate,
  updateDraftSettings,
  publishDraft,
};
