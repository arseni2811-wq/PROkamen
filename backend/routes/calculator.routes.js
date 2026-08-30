const express = require("express");
const router = express.Router();
const controller = require("../controllers/calculatorController");
const { authenticateJWT } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const {
  calculatorPreviewSchema,
  publicCalculatorLeadSchema,
  calculatorRateUpdateSchema,
  calculatorSettingsUpdateSchema,
} = require("../middleware/schemas");

router.get("/public/calculator/catalog", controller.getPublicCatalog);
router.post("/public/calculator/preview", validate(calculatorPreviewSchema), controller.publicPreview);
router.post("/public/calculator/leads", validate(publicCalculatorLeadSchema), controller.submitPublicLead);

router.post("/calculator/preview", authenticateJWT, authorize(1, 2), validate(calculatorPreviewSchema), controller.internalPreview);
router.get("/calculator/admin", authenticateJWT, authorize(1), controller.getAdminData);
router.put("/calculator/admin/rates/:code", authenticateJWT, authorize(1), validate(calculatorRateUpdateSchema), controller.updateRate);
router.put("/calculator/admin/settings", authenticateJWT, authorize(1), validate(calculatorSettingsUpdateSchema), controller.updateSettings);
router.post("/calculator/admin/publish", authenticateJWT, authorize(1), controller.publish);

module.exports = router;
