const express = require("express");
const controller = require("../controllers/portfolioController");
const { authenticateJWT } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const { portfolioProjectSchema, portfolioImageOrderSchema } = require("../middleware/portfolioSchemas");
const { handlePortfolioUpload, validatePortfolioSignatures } = require("../middleware/portfolioUpload");

const router = express.Router();
router.use(authenticateJWT, authorize(1));
router.param("id", (req, res, next, value) => {
  if (!controller.validId(value)) return res.status(400).json({ success: false, message: "Некорректный ID работы" });
  next();
});
router.param("imageId", (req, res, next, value) => {
  if (!controller.validId(value)) return res.status(400).json({ success: false, message: "Некорректный ID фотографии" });
  next();
});
router.get("/", controller.listProjects);
router.get("/:id", controller.getProject);
router.post("/", validate(portfolioProjectSchema), controller.createProject);
router.put("/:id", validate(portfolioProjectSchema), controller.updateProject);
router.delete("/:id", controller.archiveProject);
router.post("/:id/images", handlePortfolioUpload, validatePortfolioSignatures, controller.uploadImages);
router.put("/:id/images/order", validate(portfolioImageOrderSchema), controller.saveImageOrder);
router.get("/:id/images/:imageId/file", controller.serveImage);
router.delete("/:id/images/:imageId", controller.deleteImage);
module.exports = router;
