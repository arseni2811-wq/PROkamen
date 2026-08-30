const defaultStatuses = [
  ["lead", "Лид", 1],
  ["new", "Новая заявка", 5],
  ["measurement", "Замер / Выезд", 15],
  ["quote_approval", "Согласование КП", 22],
  ["waiting_payment", "Ожидание оплаты", 25],
  ["waiting_stone", "Ожидание камня", 28],
  ["in_production", "В производстве", 32],
  ["ready_shipping", "Готов к отгрузке", 35],
  ["logistics_install", "Доставка и монтаж", 42],
  ["final_calculation", "Финальный расчет", 45],
  ["archived", "Архив", 55],
  ["cancelled", "Отменен", 60],
];

async function ensureOrderStatuses(pool) {
  for (const [statusId, statusName, sortOrder] of defaultStatuses) {
    await pool.query(
      `INSERT INTO dict_order_statuses (status_id, status_name, sort_order)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status_name = VALUES(status_name), sort_order = VALUES(sort_order)`,
      [statusId, statusName, sortOrder],
    );
  }
  console.log(`✅ Статусы заказов синхронизированы (${defaultStatuses.length})`);
}

module.exports = { ensureOrderStatuses };
