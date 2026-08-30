const express = require("express");
const router = express.Router();
const {
  getAllOrders,
  getProductionOrders,
  getOrderById,
  updateOrder,
  updateOrderCalculator,
  createOrder,
  updateOrderStatus,
  logOrderAction,
} = require("../controllers/ordersController");
const { authenticateJWT } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  orderSchema,
  orderUpdateSchema,
  calculatorUpdateSchema,
  statusUpdateSchema,
} = require("../middleware/schemas");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const pool = require("../db");
const { hasAllowedFileSignature } = require("../utils/fileSignatures");
const {
  safeDisplayFilename,
  attachmentContentDisposition,
} = require("../utils/filenames");
const {
  authorizeOrderCollection,
  authorizeOrderCreation,
  authorizeProductionRead,
  authorizeOrderObject,
} = require("../middleware/orderAccess");

router.param("id", (req, res, next, value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Некорректный ID заказа" });
  }
  next();
});

// Worker threads для асинхронной генерации PDF
const { Worker } = require("worker_threads");
const pdfWorkerPath = path.join(__dirname, "..", "workers", "pdf.worker.js");

// Безопасный парсинг calculator_snapshot.
// MySQL JSON-колонка уже возвращает объект, но в старых строках может
// лежать строка, "[object Object]" или null — JSON.parse в этих случаях
// падает с "... is not valid JSON".
function safeParseSnapshot(value) {
  if (value === null || value === undefined || value === "") return {};
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = req.params.id;
    const uploadRoot =
      process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
    const dir = path.join(
      uploadRoot,
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
  fileFilter: (req, file, cb) => {
    const allowedExtensions = new Set([
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
    ]);
    file.originalname = safeDisplayFilename(file.originalname);
    const extension = path.extname(file.originalname).toLowerCase();
    if (!file.originalname || file.originalname.length > 255) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    cb(
      allowedExtensions.has(extension)
        ? null
        : new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname),
      allowedExtensions.has(extension),
    );
  },
});

function handleOrderUpload(req, res, next) {
  upload.array("files", 20)(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Файл превышает лимит 50 МБ"
            : "Недопустимый тип или количество файлов",
      });
    }
    next();
  });
}

async function validateUploadedFileSignatures(req, res, next) {
  try {
    for (const file of req.files || []) {
      const handle = await fs.promises.open(file.path, "r");
      const header = Buffer.alloc(16);
      let bytesRead = 0;
      try {
        ({ bytesRead } = await handle.read(header, 0, header.length, 0));
      } finally {
        await handle.close();
      }
      if (
        !hasAllowedFileSignature(
          file.originalname,
          header.subarray(0, bytesRead),
        )
      ) {
        await Promise.all(
          (req.files || []).map((uploaded) =>
            fs.promises.unlink(uploaded.path).catch(() => undefined),
          ),
        );
        return res.status(400).json({
          success: false,
          message: "Содержимое файла не соответствует его расширению",
        });
      }
    }
    next();
  } catch (error) {
    await Promise.all(
      (req.files || []).map((file) =>
        fs.promises.unlink(file.path).catch(() => undefined),
      ),
    );
    next(error);
  }
}

router.get("/", authenticateJWT, authorizeOrderCollection, getAllOrders);
router.get(
  "/production",
  authenticateJWT,
  authorizeProductionRead,
  getProductionOrders,
);
router.get("/:id", authenticateJWT, authorizeOrderObject, getOrderById);
router.put(
  "/:id",
  authenticateJWT,
  authorizeOrderObject,
  validate(orderUpdateSchema),
  updateOrder,
);
router.post(
  "/",
  authenticateJWT,
  authorizeOrderCreation,
  validate(orderSchema),
  createOrder,
);
router.put(
  "/:id/calculator",
  authenticateJWT,
  authorizeOrderObject,
  validate(calculatorUpdateSchema),
  updateOrderCalculator,
);
router.put(
  "/:id/status",
  authenticateJWT,
  authorizeOrderObject,
  validate(statusUpdateSchema),
  updateOrderStatus,
);

router.post(
  "/:id/upload",
  authenticateJWT,
  authorizeOrderObject,
  handleOrderUpload,
  validateUploadedFileSignatures,
  async (req, res) => {
    const orderId = req.params.id;
    const fileType = req.body.file_type || "document";

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Файлы не переданы" });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const inserted = [];

      for (const file of req.files) {
        const relativePath = path.join(
          "uploads",
          "orders",
          String(orderId),
          file.filename,
        );
        const [result] = await connection.query(
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

      // Пишем в журнал действий
      await logOrderAction(
        connection,
        orderId,
        "Загрузка файлов",
        `Загружено файлов: ${inserted.length} (тип: ${fileType})`,
        req.user?.user_id,
      );

      await connection.commit();

      res.json({
        success: true,
        message: `Загружено ${inserted.length} файлов`,
        files: inserted,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      await Promise.all(
        (req.files || []).map((file) =>
          fs.promises.unlink(file.path).catch(() => undefined),
        ),
      );
      console.error("Ошибка сохранения файлов в БД:", error);
      res.status(500).json({
        success: false,
        message: "Не удалось сохранить файлы",
      });
    } finally {
      if (connection) connection.release();
    }
  },
);

router.get(
  "/:id/attachments",
  authenticateJWT,
  authorizeOrderObject,
  async (req, res) => {
  const orderId = req.params.id;

  try {
    const [rows] = await pool.query(
      "SELECT attachment_id, file_name, file_path, file_type, created_at FROM order_attachments WHERE order_id = ? ORDER BY created_at DESC",
      [orderId],
    );

    const files = rows.map((row) => ({
      ...row,
      url: `/api/orders/${orderId}/attachments/${row.attachment_id}/download`,
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error("Ошибка получения файлов:", error);
    res.status(500).json({
      success: false,
      message: "Не удалось получить список файлов",
    });
  }
  },
);

router.get(
  "/:id/attachments/:attachmentId/download",
  authenticateJWT,
  authorizeOrderObject,
  async (req, res) => {
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID вложения",
      });
    }
    try {
      const [rows] = await pool.query(
        `SELECT attachment_id, file_name, file_path
         FROM order_attachments
         WHERE attachment_id = ? AND order_id = ?`,
        [attachmentId, req.params.id],
      );
      const attachment = rows[0];
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: "Вложение не найдено",
        });
      }
      const uploadRoot =
        process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
      const absolutePath = path.join(
        uploadRoot,
        "orders",
        String(req.params.id),
        path.basename(attachment.file_path),
      );
      try {
        await fs.promises.access(absolutePath, fs.constants.R_OK);
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: "Файл вложения не найден",
        });
      }
      res.setHeader(
        "Content-Disposition",
        attachmentContentDisposition(attachment.file_name),
      );
      return res.sendFile(absolutePath);
    } catch (error) {
      console.error("Ошибка скачивания вложения:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось скачать вложение",
      });
    }
  },
);

router.delete(
  "/:id/attachments/:attachmentId",
  authenticateJWT,
  authorizeOrderObject,
  async (req, res) => {
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID вложения",
      });
    }

    let connection;
    let originalPath = null;
    let quarantinePath = null;
    let movedToQuarantine = false;
    let committed = false;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT attachment_id, file_name, file_path
         FROM order_attachments
         WHERE attachment_id = ? AND order_id = ?
         FOR UPDATE`,
        [attachmentId, req.params.id],
      );
      const attachment = rows[0];
      if (!attachment) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "Вложение не найдено",
        });
      }

      const uploadRoot =
        process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
      const orderDirectory = path.join(
        uploadRoot,
        "orders",
        String(req.params.id),
      );
      originalPath = path.join(
        orderDirectory,
        path.basename(attachment.file_path),
      );
      quarantinePath = path.join(
        orderDirectory,
        `.deleting-${attachmentId}-${crypto.randomUUID()}`,
      );

      try {
        await fs.promises.rename(originalPath, quarantinePath);
        movedToQuarantine = true;
      } catch (error) {
        await connection.rollback();
        return res.status(error.code === "ENOENT" ? 409 : 500).json({
          success: false,
          message:
            error.code === "ENOENT"
              ? "Физический файл вложения отсутствует; metadata не удалена"
              : "Не удалось подготовить файл к удалению",
        });
      }

      await connection.query(
        "DELETE FROM order_attachments WHERE attachment_id = ? AND order_id = ?",
        [attachmentId, req.params.id],
      );
      await logOrderAction(
        connection,
        req.params.id,
        "attachment_deleted",
        `Удалено вложение: ${attachment.file_name}`,
        req.user?.user_id,
      );
      await connection.commit();
      committed = true;

      let cleanupPending = false;
      try {
        await fs.promises.unlink(quarantinePath);
      } catch (error) {
        cleanupPending = true;
        console.error("Не удалось окончательно удалить quarantine-вложение:", {
          attachment_id: attachmentId,
          code: error.code,
        });
      }

      return res.json({
        success: true,
        message: "Вложение удалено",
        attachment_id: attachmentId,
        cleanup_pending: cleanupPending,
      });
    } catch (error) {
      if (connection && !committed) {
        await connection.rollback().catch(() => undefined);
      }
      if (movedToQuarantine && !committed) {
        await fs.promises.rename(quarantinePath, originalPath).catch((restoreError) => {
          console.error("Не удалось восстановить вложение после rollback:", {
            attachment_id: attachmentId,
            code: restoreError.code,
          });
        });
      }
      console.error("Ошибка удаления вложения:", error);
      return res.status(500).json({
        success: false,
        message: "Не удалось удалить вложение",
      });
    } finally {
      if (connection) connection.release();
    }
  },
);

router.get("/:id/pdf", authenticateJWT, authorizeOrderObject, async (req, res) => {
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
    const snapshot = safeParseSnapshot(order.calculator_snapshot);
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
    res.status(500).json({
      success: false,
      message: "Не удалось сформировать PDF",
    });
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

router.get("/:id/history", authenticateJWT, authorizeOrderObject, async (req, res) => {
  const orderId = req.params.id;

  try {
    const [rows] = await pool.query(
      `
        SELECT
          h.created_at,
          h.action,
          h.description,
          COALESCE(u.full_name, 'Система') AS user_name
        FROM order_history_log h
        LEFT JOIN users u ON h.user_id = u.user_id
        WHERE h.order_id = ?
        ORDER BY h.created_at DESC
      `,
      [orderId],
    );
    res.json({ success: true, history: rows });
  } catch (error) {
    console.error("Ошибка получения истории заказа:", error);
    res.status(500).json({
      success: false,
      message: "Не удалось получить историю заказа",
    });
  }
});

module.exports = router;
