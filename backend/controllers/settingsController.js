const pool = require("../db");

// Получение курса валют
async function getExchangeRate(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'exchange_rate' LIMIT 1",
    );

    const rate = rows.length > 0 ? parseFloat(rows[0].setting_value) : 3.2;
    res.json({ success: true, exchange_rate: rate });
  } catch (error) {
    console.error("Ошибка получения курса валют:", error);
    res.status(500).json({
      success: false,
      message: "Не удалось получить курс валют",
    });
  }
}

// Обновление курса валют (только для админов)
async function updateExchangeRate(req, res) {
  const { exchange_rate } = req.validatedBody;

  try {
    await pool.query(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('exchange_rate', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [exchange_rate, exchange_rate],
    );

    res.json({ success: true, message: "Курс валют обновлен", exchange_rate });
  } catch (error) {
    console.error("Ошибка обновления курса валют:", error);
    res.status(500).json({
      success: false,
      message: "Не удалось обновить курс валют",
    });
  }
}

module.exports = {
  getExchangeRate,
  updateExchangeRate,
};
