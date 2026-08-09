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

function canTransition(fromStatus, toStatus) {
  if (toStatus === "cancelled") return true;
  const allowed = statusTransitions[fromStatus];
  if (!allowed) return false;
  return allowed.next.includes(toStatus);
}

module.exports = { canTransition };
