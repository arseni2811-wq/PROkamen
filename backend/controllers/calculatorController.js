const pool = require("../db");
const repository = require("../services/calculatorRepository");
const calculator = require("../services/calculatorService");

async function loadPricebook(body, publicMode) {
  const pricebook = await repository.getPublishedPricebook({
    materialId: body.materialId,
    slabFormatCode: body.slabFormatCode,
    customFormat: body.customFormat,
    publicMode,
  });
  if (!pricebook) throw Object.assign(new Error("Материал или прайс недоступен"), { status: 404 });
  return pricebook;
}

async function getPublicCatalog(req, res, next) {
  try {
    res.json({ success: true, ...(await repository.getPublicCatalog()) });
  } catch (error) { next(error); }
}

async function publicPreview(req, res, next) {
  try {
    const pricebook = await loadPricebook(req.validatedBody, true);
    const configuration = {
      ...req.validatedBody.configuration,
      manualSlabCount: null,
      manualMaterialPriceUsdCents: 0,
      managerAdjustmentBynCents: 0,
      additionalLines: [],
    };
    res.json({ success: true, calculation: calculator.calculate(configuration, pricebook, "public") });
  } catch (error) { next(error); }
}

async function internalPreview(req, res, next) {
  try {
    const pricebook = await loadPricebook(req.validatedBody, false);
    res.json({ success: true, calculation: calculator.calculate(req.validatedBody.configuration, pricebook, "internal") });
  } catch (error) { next(error); }
}

async function submitPublicLead(req, res, next) {
  try {
    const pricebook = await loadPricebook(req.validatedBody, true);
    const configuration = {
      ...req.validatedBody.configuration,
      manualSlabCount: null,
      manualMaterialPriceUsdCents: 0,
      managerAdjustmentBynCents: 0,
      additionalLines: [],
    };
    const publicCalculation = calculator.calculate(configuration, pricebook, "public");
    const internalSnapshot = calculator.calculate(configuration, pricebook, "internal");
    const [result] = await pool.query(
      `INSERT INTO public_calculator_leads
       (contact_name, phone, email, comment, configuration_json, calculation_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.validatedBody.contact.name, req.validatedBody.contact.phone,
       req.validatedBody.contact.email || null, req.validatedBody.contact.comment || null,
       JSON.stringify(configuration), JSON.stringify(internalSnapshot)],
    );
    res.status(201).json({ success: true, leadId: result.insertId, calculation: publicCalculation });
  } catch (error) { next(error); }
}

async function getAdminData(req, res, next) {
  try { res.json({ success: true, ...(await repository.getAdminPricebook()) }); }
  catch (error) { next(error); }
}

async function updateRate(req, res, next) {
  try {
    const draft = await repository.updateDraftRate(req.user.user_id, req.params.code, req.validatedBody);
    res.json({ success: true, draftVersion: draft.version_number });
  } catch (error) { next(error); }
}

async function updateSettings(req, res, next) {
  try {
    const draft = await repository.updateDraftSettings(req.user.user_id, req.validatedBody);
    res.json({ success: true, draftVersion: draft.version_number });
  } catch (error) { next(error); }
}

async function publish(req, res, next) {
  try { res.json({ success: true, ...(await repository.publishDraft(req.user.user_id)) }); }
  catch (error) { next(error); }
}

module.exports = { getPublicCatalog, publicPreview, internalPreview, submitPublicLead, getAdminData, updateRate, updateSettings, publish };
