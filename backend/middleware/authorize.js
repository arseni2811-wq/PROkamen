function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Не авторизован." });
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Недостаточно прав.",
      });
    }

    next();
  };
}

module.exports = { authorize };
