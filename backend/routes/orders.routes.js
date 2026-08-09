const express = require("express");
const router = express.Router();
const {
  getAllOrders,
  getOrderById,
  updateOrder,
  createOrder,
  updateOrderStatus,
} = require("../controllers/ordersController");
const { authenticateJWT } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { orderSchema, statusUpdateSchema } = require("../middleware/schemas");
const multer = require("multer");
const path = require("path");
const fs = require("path");
const pool = require("../db");

// Worker threads для асинхронной генерации PDF
const { Worker } = require("worker_threads");
const pdfWorkerPath = path.join(__dirname, "..", "workers", "pdf.worker.js");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = req.params.id;
    const dir = path.join(
      __dirname,
      "..",
      "uploads",
      "orders",
      String(orderId),
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/", authenticateJWT, getAllOrders);
router.get("/:id", authenticateJWT, getOrderById);
router.put("/:id", authenticateJWT, validate(orderSchema), updateOrder);
router.post("/", authenticateJWT, validate(orderSchema), createOrder);
router.put(
  "/:id/status",
  authenticateJWT,
  validate(statusUpdateSchema),
  updateOrderStatus,
);

router.post(
  "/:id/upload",
  authenticateJWT,
  upload.array("files", 20),
  async (req, res) => {
    const orderId = req.params.id;
    const fileType = req.body.file_type || "document";

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Файлы не переданы" });
    }

    try {
      const inserted = [];

      for (const file of req.files) {
        const relativePath = path.join(
          "uploads",
          "orders",
          String(orderId),
          file.filename,
        );
        const [result] = await pool.query(
          "INSERT INTO order_attachments (order_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)",
          [orderId, file.originalname, relativePath, fileType],
        );
        inserted.push({
          attachment_id: result.insertId,
          file_name: file.originalname,
          file_path: relativePath,
          file_type: fileType,
        });
      }

      res.json({
        success: true,
        message: `Загружено ${inserted.length} файлов`,
        files: inserted,
      });
    } catch (error) {
      console.error("Ошибка сохранения файлов в БД:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

router.get("/:id/attachments", authenticateJWT, async (req, res) => {
  const orderId = req.params.id;

  try {
    const [rows] = await pool.query(
      "SELECT attachment_id, file_name, file_path, file_type, created_at FROM order_attachments WHERE order_id = ? ORDER BY created_at DESC",
      [orderId],
    );

    const files = rows.map((row) => ({
      ...row,
      url: `http://localhost:3000/${row.file_path.replace(/\\/g, "/")}`,
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error("Ошибка получения файлов:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id/pdf", authenticateJWT, async (req, res) => {
  const orderId = req.params.id;
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 5)}`;

  try {
    const [orderRows] = await pool.query(
      `
        SELECT
          o.order_id,
          o.total_amount,
          o.prepayment,
          o.installation_address,
          o.deadline_date,
          o.calculator_snapshot,
          c.full_name AS client_name,
          c.phone AS client_phone,
          c.email AS client_email
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.client_id
        WHERE o.order_id = ?
      `,
      [orderId],
    );

    if (!orderRows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Заказ не найден" });
    }

    const order = orderRows[0];
    const snapshot = JSON.parse(order.calculator_snapshot || "{}");
    const today = new Date().toLocaleDateString("ru-RU");

    // Отправляем задачу в worker thread
    const pdfBuffer = await generatePDFInWorker({
      order,
      snapshot,
      today,
      requestId,
    });

    // Отправляем готовый PDF клиенту
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="KP_${order.order_id}.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Ошибка генерации PDF:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ГЕНЕРАЦИЯ PDF В WORKER
// =========================================================

function generatePDFInWorker(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(pdfWorkerPath);
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Таймаут генерации PDF (30 сек)"));
    }, 30000);

    worker.on("message", (message) => {
      if (message.requestId !== payload.requestId) return;

      clearTimeout(timeout);

      if (message.type === "PDF_READY" && message.success) {
        worker.terminate();
        resolve(message.buffer);
      } else if (message.type === "ERROR") {
        worker.terminate();
        reject(new Error(message.error || "Ошибка генерации PDF"));
      }
    });

    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });

    worker.postMessage({
      type: "GENERATE_PDF",
      payload,
      requestId: payload.requestId,
    });
  });
}

module.exports = router;
