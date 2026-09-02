const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const controller = require("../controllers/calculatorController");
const { authenticateJWT } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const {
  calculatorPreviewSchema,
  publicCalculatorLeadSchema,
  calculatorRateUpdateSchema,
  calculatorSettingsUpdateSchema,
  calculatorMaterialUpdateSchema,
  calculatorSlabFormatUpdateSchema,
} = require("../middleware/schemas");
const { hasAllowedFileSignature } = require("../utils/fileSignatures");
const { safeDisplayFilename } = require("../utils/filenames");

const leadUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      const root = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
      const dir = path.join(root, "calculator-leads", String(req.params.leadId));
      fs.mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    file.originalname = safeDisplayFilename(file.originalname);
    callback(null, [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".dwg"].includes(path.extname(file.originalname).toLowerCase()));
  },
});

function handleLeadUpload(req, res, next) {
  leadUpload.single("file")(req, res, async (error) => {
    if (error || !req.file) return res.status(400).json({ success: false, message: error?.code === "LIMIT_FILE_SIZE" ? "Файл превышает 15 МБ" : "Разрешены PDF, DWG, PNG, JPG и WEBP" });
    try {
      const handle = await fs.promises.open(req.file.path, "r");
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      await handle.close();
      if (!hasAllowedFileSignature(req.file.originalname, header.subarray(0, bytesRead))) {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
        return res.status(400).json({ success: false, message: "Содержимое файла не соответствует его расширению" });
      }
      next();
    } catch (readError) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      next(readError);
    }
  });
}

router.get("/public/calculator/catalog", controller.getPublicCatalog);
router.post("/public/calculator/preview", validate(calculatorPreviewSchema), controller.publicPreview);
router.post("/public/calculator/pdf", validate(calculatorPreviewSchema), controller.publicPdf);
router.post("/public/calculator/leads", validate(publicCalculatorLeadSchema), controller.submitPublicLead);
router.post("/public/calculator/leads/:leadId/attachment", handleLeadUpload, controller.uploadPublicLeadAttachment);

router.post("/calculator/preview", authenticateJWT, authorize(1, 2), validate(calculatorPreviewSchema), controller.internalPreview);
router.get("/calculator/catalog", authenticateJWT, authorize(1, 2), controller.getInternalCatalog);
router.get("/calculator/admin", authenticateJWT, authorize(1), controller.getAdminData);
router.put("/calculator/admin/rates/:code", authenticateJWT, authorize(1), validate(calculatorRateUpdateSchema), controller.updateRate);
router.put("/calculator/admin/settings", authenticateJWT, authorize(1), validate(calculatorSettingsUpdateSchema), controller.updateSettings);
router.put("/calculator/admin/materials/:id", authenticateJWT, authorize(1), validate(calculatorMaterialUpdateSchema), controller.updateMaterial);
router.put("/calculator/admin/formats/:code", authenticateJWT, authorize(1), validate(calculatorSlabFormatUpdateSchema), controller.updateSlabFormat);
router.post("/calculator/admin/publish", authenticateJWT, authorize(1), controller.publish);

module.exports = router;
