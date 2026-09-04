const pool = require("../db");
const repository = require("../services/calculatorRepository");
const calculator = require("../services/calculatorService");
const { createPublicCalculatorPdf } = require("../services/publicCalculatorPdf");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function publicConfiguration(configuration) {
  return {
    ...configuration,
    manualSlabCount: null,
    manualMaterialPriceUsdCents: 0,
    materialMarkupBps: 0,
    additionalMaterialBynCents: 0,
    managerAdjustmentBynCents: 0,
    additionalLines: [],
  };
}

async function loadPricebook(body, publicMode) {
  const pricebook = await repository.getPublishedPricebook({
    materialId: body.materialId,
    materialVariantId: body.materialVariantId,
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

async function getInternalCatalog(req, res, next) {
  try {
    res.json({ success: true, ...(await repository.getInternalCatalog()) });
  } catch (error) { next(error); }
}

async function publicPreview(req, res, next) {
  try {
    const pricebook = await loadPricebook(req.validatedBody, true);
    const configuration = publicConfiguration(req.validatedBody.configuration);
    res.json({ success: true, calculation: calculator.calculate(configuration, pricebook, "public") });
  } catch (error) { next(error); }
}

async function publicPdf(req, res, next) {
  try {
    const pricebook = await loadPricebook(req.validatedBody, true);
    const configuration = publicConfiguration(req.validatedBody.configuration);
    const calculation = calculator.calculate(configuration, pricebook, "public");
    const buffer = await createPublicCalculatorPdf(calculation, configuration);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="PRO-Kamen-calculation.pdf"');
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
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
    const configuration = publicConfiguration(req.validatedBody.configuration);
    const publicCalculation = calculator.calculate(configuration, pricebook, "public");
    const internalSnapshot = calculator.calculate(configuration, pricebook, "internal");
    const attachmentToken = crypto.randomBytes(24).toString("hex");
    const storedConfiguration = {
      ...configuration,
      _leadAttachmentTokenHash: crypto.createHash("sha256").update(attachmentToken).digest("hex"),
      customerAttachments: [],
    };
    const [result] = await pool.query(
      `INSERT INTO public_calculator_leads
       (contact_name, phone, email, comment, configuration_json, calculation_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.validatedBody.contact.name, req.validatedBody.contact.phone,
       req.validatedBody.contact.email || null, req.validatedBody.contact.comment || null,
       JSON.stringify(storedConfiguration), JSON.stringify(internalSnapshot)],
    );
    res.status(201).json({ success: true, leadId: result.insertId, attachmentToken, calculation: publicCalculation });
  } catch (error) { next(error); }
}

async function uploadPublicLeadAttachment(req, res, next) {
  const removeUploaded = () => req.file?.path
    ? fs.promises.unlink(req.file.path).catch(() => undefined)
    : Promise.resolve();
  try {
    const leadId = Number(req.params.leadId);
    if (!Number.isSafeInteger(leadId) || leadId <= 0 || !req.file) {
      await removeUploaded();
      return res.status(400).json({ success: false, message: "Файл или номер заявки некорректен" });
    }
    const token = String(req.body.token || "");
    const [rows] = await pool.query("SELECT configuration_json FROM public_calculator_leads WHERE lead_id = ?", [leadId]);
    const stored = rows[0]?.configuration_json;
    const configuration = typeof stored === "string" ? JSON.parse(stored) : stored;
    const expected = String(configuration?._leadAttachmentTokenHash || "");
    const actual = crypto.createHash("sha256").update(token).digest("hex");
    if (!expected || expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      await removeUploaded();
      return res.status(403).json({ success: false, message: "Ссылка загрузки недействительна" });
    }
    if ((configuration.customerAttachments || []).length >= 1) {
      await removeUploaded();
      return res.status(409).json({ success: false, message: "К заявке уже прикреплён файл" });
    }
    const relativePath = path.join("uploads", "calculator-leads", String(leadId), req.file.filename);
    const attachment = { name: req.file.originalname, path: relativePath, type: req.file.mimetype, size: req.file.size };
    const customerAttachments = [attachment];
    await pool.query(
      "UPDATE public_calculator_leads SET configuration_json = ? WHERE lead_id = ?",
      [JSON.stringify({ ...configuration, customerAttachments }), leadId],
    );
    res.status(201).json({ success: true, file: { name: attachment.name, size: attachment.size } });
  } catch (error) {
    await removeUploaded();
    next(error);
  }
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

async function updateMaterial(req, res, next) {
  try {
    await repository.updateMaterial(req.user.user_id, req.params.id, req.validatedBody);
    res.json({ success: true });
  } catch (error) { next(error); }
}

async function updateSlabFormat(req, res, next) {
  try {
    await repository.updateSlabFormat(req.user.user_id, req.params.code, req.validatedBody);
    res.json({ success: true });
  } catch (error) { next(error); }
}

module.exports = { getPublicCatalog, getInternalCatalog, publicPreview, publicPdf, internalPreview, submitPublicLead, uploadPublicLeadAttachment, getAdminData, updateRate, updateSettings, publish, updateMaterial, updateSlabFormat };
