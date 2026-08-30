const express = require("express");
const router = express.Router();
const { getClients } = require("../controllers/clientsController");
const { authenticateJWT } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

// GET /api/clients — список клиентов с агрегатами (только для авторизованных)
router.get("/", authenticateJWT, authorize(1, 2), getClients);

module.exports = router;
