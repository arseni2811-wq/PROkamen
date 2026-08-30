const express = require("express");
const router = express.Router();
const {
  getExchangeRate,
  updateExchangeRate,
} = require("../controllers/settingsController");
const { authenticateJWT } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { authorize } = require("../middleware/authorize");
const { z } = require("zod");

const ROLES = {
  ADMIN: 1,
  MANAGER: 2,
};

const exchangeRateSchema = z.object({
  exchange_rate: z.number().positive(),
});

router.get(
  "/exchange-rate",
  authenticateJWT,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  getExchangeRate,
);

router.put(
  "/exchange-rate",
  authenticateJWT,
  authorize(ROLES.ADMIN),
  validate(exchangeRateSchema),
  updateExchangeRate,
);

module.exports = router;
