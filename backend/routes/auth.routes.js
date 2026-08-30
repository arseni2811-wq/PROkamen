const express = require("express");
const router = express.Router();
const { login, logout } = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const { loginSchema } = require("../middleware/schemas");
const { createRateLimit } = require("../middleware/rateLimit");

const loginIpRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
});

const loginAccountRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(req.body?.login || "").trim().toLowerCase()}`,
});

router.post(
  "/login",
  loginIpRateLimit,
  loginAccountRateLimit,
  validate(loginSchema),
  login,
);
router.post("/logout", logout);

module.exports = router;
