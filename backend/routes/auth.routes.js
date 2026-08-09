const express = require("express");
const router = express.Router();
const { login, logout } = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const { loginSchema } = require("../middleware/schemas");

router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);

module.exports = router;
