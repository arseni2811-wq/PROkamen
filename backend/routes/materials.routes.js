const express = require("express");
const router = express.Router();
const {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getServices,
  updateServices,
} = require("../controllers/materialsController");
const { authenticateJWT } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { authorize } = require("../middleware/authorize");
const { materialSchema, servicesSchema } = require("../middleware/schemas");

const ROLES = {
  ADMIN: 1,
  MANAGER: 2,
};

router.get("/", authenticateJWT, getMaterials);
router.get("/services", authenticateJWT, getServices);

router.post(
  "/",
  authenticateJWT,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate(materialSchema),
  createMaterial,
);

router.put(
  "/:id",
  authenticateJWT,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate(materialSchema),
  updateMaterial,
);

router.delete("/:id", authenticateJWT, authorize(ROLES.ADMIN), deleteMaterial);

router.put(
  "/services",
  authenticateJWT,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate(servicesSchema),
  updateServices,
);

module.exports = router;
