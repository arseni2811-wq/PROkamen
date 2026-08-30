const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

// Достаёт JWT из заголовка Authorization: Bearer <token>
function extractBearerToken(req) {
  const authHeader = req.headers && req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }
  return null;
}

function authenticateJWT(req, res, next) {
  // Поддерживаем оба способа аутентификации:
  // 1) Authorization: Bearer <token> — из localStorage на фронтенде,
  // 2) httpOnly cookie "token" — классический вариант.
  const token = extractBearerToken(req) || req.cookies?.token;
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Не авторизован. Токен отсутствует." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Токен недействителен или истёк." });
  }
}

module.exports = { authenticateJWT };
