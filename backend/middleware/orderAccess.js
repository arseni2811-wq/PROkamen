const pool = require("../db");

const ROLES = Object.freeze({ ADMIN: 1, MANAGER: 2, WORKER: 3 });

function deny(res) {
  return res.status(403).json({
    success: false,
    message: "Доступ к заказу запрещен",
  });
}

function authorizeOrderCollection(req, res, next) {
  if ([ROLES.ADMIN, ROLES.MANAGER].includes(req.user?.role_id)) return next();
  return deny(res);
}

function authorizeOrderCreation(req, res, next) {
  return authorizeOrderCollection(req, res, next);
}

function authorizeProductionRead(req, res, next) {
  if (Object.values(ROLES).includes(req.user?.role_id)) return next();
  return deny(res);
}

async function authorizeOrderObject(req, res, next) {
  const orderId = Number(req.params.id);
  try {
    const [rows] = await pool.query(
      "SELECT order_id, manager_id FROM orders WHERE order_id = ?",
      [orderId],
    );
    const order = rows[0];
    if (!order) {
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    if (req.user?.role_id === ROLES.ADMIN) {
      req.authorizedOrder = order;
      return next();
    }
    if (
      req.user?.role_id === ROLES.MANAGER &&
      Number(order.manager_id) === Number(req.user.user_id)
    ) {
      req.authorizedOrder = order;
      return next();
    }
    return deny(res);
  } catch (error) {
    return next(error);
  }
}

function attachmentOrderId(req) {
  const match = /^\/orders\/(\d+)(?:\/|$)/.exec(req.path || "");
  return match ? Number(match[1]) : null;
}

async function authorizeAttachmentDownload(req, res, next) {
  const orderId = attachmentOrderId(req);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return res.status(404).send("Not found");
  }
  req.params.id = String(orderId);
  return authorizeOrderObject(req, res, next);
}

module.exports = {
  ROLES,
  authorizeOrderCollection,
  authorizeOrderCreation,
  authorizeProductionRead,
  authorizeOrderObject,
  authorizeAttachmentDownload,
};
