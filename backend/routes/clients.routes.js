const express = require("express");
const router = express.Router();
const { getClients } = require("../controllers/clientsController");
const { authenticateJWT } = require("../middleware/auth");

// GET /api/clients — список клиентов с агрегатами (только для авторизованных)
router.get("/", authenticateJWT, getClients);

module.exports = router;