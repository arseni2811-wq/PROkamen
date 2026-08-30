const pool = require("../db");

// Получение списка клиентов с суммарной выручкой (LTV)
// ВАЖНО: возвращается МАССИВ, а не { clients: [...] } — так ожидает
// фронтенд public/crm/crm/js/clients.js (Array.isArray(data)).
async function getClients(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.client_id,
        c.full_name,
        c.phone,
        c.email,
        c.created_at,
        COUNT(o.order_id) AS orders_count,
        COALESCE(SUM(o.total_amount), 0) AS totalRevenue
      FROM clients c
      LEFT JOIN orders o ON o.client_id = c.client_id
      GROUP BY c.client_id, c.full_name, c.phone, c.email, c.created_at
      ORDER BY totalRevenue DESC, c.full_name ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении клиентов:", error);
    res.status(500).json({
      success: false,
      message: "Не удалось получить клиентов",
    });
  }
}

module.exports = { getClients };
