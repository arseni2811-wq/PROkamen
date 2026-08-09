const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { loginSchema } = require("../middleware/schemas");
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_crm_key";

// Вход
async function login(req, res) {
  const { login, password } = req.validatedBody;

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE login = ?", [
      login,
    ]);
    const user = rows[0];

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Неверный логин или пароль" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Неверный логин или пароль" });
    }

    const token = jwt.sign(
      { user_id: user.user_id, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 86400000,
    });

    delete user.password_hash;
    res.json({ success: true, message: "Вход выполнен успешно!", user });
  } catch (error) {
    console.error("Ошибка при входе:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера" });
  }
}

// Выход
function logout(req, res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.json({ success: true, message: "Выход выполнен успешно." });
}

module.exports = {
  login,
  logout,
};
