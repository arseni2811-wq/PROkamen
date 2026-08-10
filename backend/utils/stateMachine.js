// Полный набор статусов, поддерживаемых фронтендом
// (колонки канбана + карточка заказа). Должны присутствовать в dict_order_statuses.
const ALL_STATUSES = [
  "lead",
  "new",
  "measurement",
  "quote_approval",
  "waiting_payment",
  "waiting_stone",
  "in_production",
  "ready_shipping",
  "logistics_install",
  "final_calculation",
  "archived",
  "cancelled",
];

// Исходная строгая карта переходов (сохранена как «бизнес-документация»).
// Фактическое правило ниже — гибкое: канбан-доска позволяет перемещать карточку
// между любыми корректными статусами, а администратор (role_id === 1) — всегда.
const statusTransitions = {
  lead: { next: ["measurement", "new"], prev: [] },
  new: { next: ["measurement"], prev: ["lead"] },
  measurement: { next: ["quote_approval"], prev: ["lead", "new"] },
  quote_approval: { next: ["waiting_payment"], prev: ["measurement"] },
  waiting_payment: {
    next: ["waiting_stone", "cancelled"],
    prev: ["quote_approval"],
  },
  waiting_stone: {
    next: ["in_production", "cancelled"],
    prev: ["waiting_payment"],
  },
  in_production: { next: ["ready_shipping"], prev: ["waiting_stone"] },
  ready_shipping: { next: ["logistics_install"], prev: ["in_production"] },
  logistics_install: { next: ["final_calculation"], prev: ["ready_shipping"] },
  final_calculation: { next: ["archived"], prev: ["logistics_install"] },
  archived: { next: [], prev: ["final_calculation"] },
  cancelled: { next: [], prev: ["*"] },
};

function canTransition(fromStatus, toStatus, options = {}) {
  // Администратор может двигать заказ в любой статус
  if (options && options.isAdmin) return true;
  // Отмена разрешена из любого статуса
  if (toStatus === "cancelled") return true;
  // Статус обязан существовать в справочнике (иначе FK-ошибка → 500)
  if (!ALL_STATUSES.includes(toStatus)) return false;
  // Свободное перемещение между корректными статусами (канбан-доска)
  return true;
}

module.exports = { canTransition, ALL_STATUSES };
