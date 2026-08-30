// ========== АВТОРИЗАЦИЯ ==========
function checkAuth() {
  const user = Store.getUser();

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  return user;
}

function normalizeOrderStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  const map = {
    lead: "new",
    new: "new",
    "new-order": "new",
    measurement: "measurement",
    measured: "measurement",
    quote_approval: "quote_approval",
    quote: "quote_approval",
    approval: "quote_approval",
    waiting_payment: "waiting_payment",
    payment: "waiting_payment",
    waiting_stone: "waiting_stone",
    stone: "waiting_stone",
    in_production: "in_production",
    production: "in_production",
    ready_shipping: "ready_shipping",
    shipping: "ready_shipping",
    logistics_install: "logistics_install",
    logistics: "logistics_install",
    final_calculation: "final_calculation",
    final: "final_calculation",
    complete: "final_calculation",
  };

  return map[normalized] || normalized || "new";
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener("DOMContentLoaded", function () {
  Store.initFromStorage();
  const user = checkAuth();

  if (!user) return;

  const userNameElement = document.getElementById("userName");
  if (userNameElement) {
    userNameElement.textContent =
      user.full_name || user.login || "Пользователь";
  }

  if (Number(user.role_id) !== 1) {
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = "none";
    });
  }

  renderKanban();
  setupEventListeners();
});

// ========== ЗАГРУЗКА ЗАКАЗОВ С СЕРВЕРА ==========
async function loadOrdersFromServer() {
  try {
    const data = await api.getOrders();
    // Активная доска: заказы со статусами cancelled/archived не показываем
    // (они видны в Архиве archive.html, который читает тот же GET /api/orders).
    return Array.isArray(data)
      ? data.filter(
          (o) => !["cancelled", "archived"].includes(String(o.status_id)),
        )
      : [];
  } catch (error) {
    console.error("Ошибка загрузки заказов с сервера:", error);
    return [];
  }
}

// ========== ОТРИСОВКА KANBAN ==========
async function renderKanban() {
  const orders = await loadOrdersFromServer();
  const columns = document.querySelectorAll("[data-status]");

  columns.forEach((column) => (column.innerHTML = ""));

  orders.forEach((order) => {
    const normalizedStatus = normalizeOrderStatus(order?.status_id);
    const targetColumn = document.querySelector(
      `[data-status="${normalizedStatus}"]`,
    );

    if (targetColumn) {
      const card = createOrderCard(order);
      targetColumn.appendChild(card);
    }
  });

  toggleEmptyColumns();
}

// ========== РАСЧЕТ ЦВЕТА ДЕДЛАЙНА ==========
function getDeadlineColor(deadlineDateString) {
  if (!deadlineDateString) return "text-gray-400 font-medium";

  const deadline = new Date(deadlineDateString);
  if (isNaN(deadline.getTime())) return "text-gray-400 font-medium";
  deadline.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 3) {
    return "text-emerald-600 font-semibold";
  } else if (diffDays >= 0 && diffDays <= 3) {
    return "text-amber-500 font-bold";
  } else {
    return "text-rose-600 font-bold animate-pulse";
  }
}

// ========== РАСЧЕТ СТАТУСА ОПЛАТЫ ДЛЯ БЕЙДЖА ==========
function getPaymentBadge(order) {
  const totalAmount = Number(
    order?.total_amount ?? order?.sum ?? order?.finalPrice ?? 0,
  );
  const prepayment = Number(
    order?.prepayment ?? order?.prepay ?? order?.paid_amount ?? 0,
  );

  if (totalAmount === 0) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 uppercase">Не рассчитан</span>`;
  }

  if (prepayment === 0) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide">Ожидает оплаты</span>`;
  }

  if (prepayment > 0 && prepayment < totalAmount) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">Частично</span>`;
  }

  return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wide">Оплачен</span>`;
}

// ========== СОЗДАНИЕ КАРТОЧКИ ЗАКАЗА ==========
function createOrderCard(order) {
  const card = document.createElement("div");
  card.className =
    "bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-200 order-card mb-3";
  const orderId = order?.order_id ?? order?.id ?? "---";
  card.dataset.orderId = orderId;
  card.dataset.version = String(order?.version ?? "");

  const formatDate = (dateStr) => {
    if (!dateStr) return "Не задано";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Не задано";
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const deadline = order?.deadline_date ?? order?.deadline ?? null;
  const deadlineHtml =
    deadline && !isNaN(new Date(deadline).getTime())
      ? `<div class="text-xs ${getDeadlineColor(deadline)}">⏳ до ${formatDate(deadline)}</div>`
      : `<div class="text-xs text-gray-400">⏳ Срок не задан</div>`;

  const finalDeadlineText =
    deadline && !isNaN(new Date(deadline).getTime())
      ? `до ${formatDate(deadline)}`
      : "Не задано";

  const clientName =
    order?.client_name ?? order?.full_name ?? order?.client ?? "Не указано";
  const managerName = order?.manager_name ?? order?.manager ?? "Не указан";
  const installationAddress =
    order?.installation_address ?? order?.location ?? "Не указано";
  const statusName = order?.status_name ?? order?.status ?? "Без статуса";
  const totalAmount = Number(
    order?.total_amount ?? order?.sum ?? order?.finalPrice ?? 0,
  );

  card.innerHTML = `
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="font-bold text-lg text-blue-600">#${escapeHtml(orderId)}</div>
        ${getPaymentBadge(order)}
      </div>
      <div class="flex flex-col items-end gap-1 text-right">
        <div class="text-xs text-gray-600 font-semibold">Общий срок: ${finalDeadlineText}</div>
        ${deadlineHtml}
      </div>
    </div>

    <div class="space-y-1 text-sm text-gray-500 mb-3">
      <div>👤 ${escapeHtml(clientName)}</div>
      <div>🛠 ${escapeHtml(statusName)}</div>
      <div>👷 ${escapeHtml(managerName)}</div>
      <div>📍 ${escapeHtml(installationAddress)}</div>
    </div>

    <div class="pt-2 border-t border-gray-100 font-bold text-gray-800 flex items-center">
      ${
        Number.isFinite(totalAmount) && totalAmount > 0
          ? `💰 ${totalAmount.toLocaleString("ru-RU")} BYN`
          : `<span class="text-gray-400 font-medium text-xs">⏳ Не указано</span>`
      }
    </div>
  `;

  card.addEventListener("click", function () {
    window.location.href = `order.html?id=${orderId}`;
  });

  card.draggable = true;
  card.addEventListener("dragstart", handleDragStart);
  card.addEventListener("dragend", handleDragEnd);

  return card;
}

// ========== ЛОГИКА СКРЫТИЯ ПУСТЫХ КОЛОНОК ==========
function toggleEmptyColumns() {
  const toggleEl = document.getElementById("hideEmptyToggle");
  const hideEmpty = toggleEl ? toggleEl.checked : false;

  const columns = document.querySelectorAll("[data-status]");
  columns.forEach((column) => {
    const hasCards = column.children.length > 0;
    const columnContainer = column.parentElement;

    if (hideEmpty && !hasCards) {
      columnContainer.style.transition = "all 0.3s ease-in-out";
      columnContainer.style.opacity = "0";
      columnContainer.style.transform = "scale(0.95)";
      setTimeout(() => {
        columnContainer.style.display = "none";
      }, 300);
    } else {
      columnContainer.style.display = "block";
      setTimeout(() => {
        columnContainer.style.transition = "all 0.3s ease-in-out";
        columnContainer.style.opacity = "1";
        columnContainer.style.transform = "scale(1)";
      }, 10);
    }
  });
}

function setupEventListeners() {
  const toggle = document.getElementById("hideEmptyToggle");
  if (toggle) {
    toggle.addEventListener("change", toggleEmptyColumns);
  }

  const columns = document.querySelectorAll("[data-status]");
  columns.forEach((column) => {
    column.addEventListener("dragover", handleDragOver);
    column.addEventListener("dragleave", handleDragLeave);
    column.addEventListener("drop", handleDrop);
  });
}

// ========== ЛОГИКА DRAG & DROP (OPTIMISTIC UPDATES) ==========
let draggedOrderCard = null;
let dragState = {
  orderId: null,
  version: null,
  oldStatus: null,
  newStatus: null,
  sourceColumn: null,
};

function handleDragStart(e) {
  draggedOrderCard = this;
  dragState.orderId = parseInt(this.dataset.orderId, 10);
  dragState.version = Number(this.dataset.version);
  dragState.sourceColumn = this.closest("[data-status]");
  dragState.oldStatus = dragState.sourceColumn.dataset.status;

  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.orderId);

  setTimeout(() => {
    this.classList.add("opacity-50");
  }, 0);
}

function handleDragEnd(e) {
  this.classList.remove("opacity-50");
  draggedOrderCard = null;
  dragState = {
    orderId: null,
    version: null,
    oldStatus: null,
    newStatus: null,
    sourceColumn: null,
  };

  document.querySelectorAll("[data-status]").forEach((col) => {
    col.classList.remove(
      "bg-blue-50",
      "border-dashed",
      "border-2",
      "border-blue-400",
    );
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  this.classList.add(
    "bg-blue-50",
    "border-dashed",
    "border-2",
    "border-blue-400",
  );
}

function handleDragLeave(e) {
  this.classList.remove(
    "bg-blue-50",
    "border-dashed",
    "border-2",
    "border-blue-400",
  );
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove(
    "bg-blue-50",
    "border-dashed",
    "border-2",
    "border-blue-400",
  );

  if (!draggedOrderCard) return;

  const targetColumn = this;
  const newStatus = targetColumn.dataset.status;

  if (dragState.oldStatus === newStatus) return;

  const getStatusName = (status) => {
    const colTitle = document
      .querySelector(`[data-status="${status}"]`)
      ?.previousElementSibling?.querySelector("h3")?.textContent;
    return colTitle ? colTitle.trim() : status;
  };

  if (
    confirm(
      `Вы уверены, что хотите сменить этап на «${getStatusName(newStatus)}»?`,
    )
  ) {
    // OPTIMISTIC UPDATE: немедленно перемещаем карточку в UI
    targetColumn.appendChild(draggedOrderCard);
    draggedOrderCard.style.opacity = "0.6";
    draggedOrderCard.style.border = "2px solid #3b82f6";
    draggedOrderCard.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";

    // Отправляем API-запрос в фоне
    changeOrderStatusOptimistic(
      dragState.orderId,
      newStatus,
      dragState.oldStatus,
      dragState.version,
      draggedOrderCard,
      targetColumn,
    );
  }
}

// ========== ФУНКЦИЯ СМЕНЫ СТАТУСА С OPTIMISTIC UPDATE ==========
async function changeOrderStatusOptimistic(
  orderId,
  newStatus,
  oldStatus,
  version,
  cardElement,
  targetColumn,
) {
  // Сохраняем ссылку на исходную колонку для возможного отката
  const sourceColumn = dragState.sourceColumn;

  try {
    // Отправляем запрос на сервер (не блокируя UI)
    await api.updateOrderStatus(orderId, newStatus, null, version);

    // Успех: убираем подсветку
    cardElement.style.opacity = "1";
    cardElement.style.border = "";
    cardElement.style.boxShadow = "";

    // Обновляем доску если мы на dashboard
    if (
      window.location.pathname.includes("dashboard.html") ||
      window.location.pathname.endsWith("/")
    ) {
      await renderKanban();
    }

    // Показываем уведомление об успехе
    showNotification(`✅ Статус заказа #${orderId} обновлен`, "success");
  } catch (error) {
    console.error("Ошибка смены статуса:", error);

    // ROLLBACK: возвращаем карточку в исходную колонку
    if (sourceColumn) {
      sourceColumn.appendChild(cardElement);
    }

    // Восстанавливаем визуальное состояние
    cardElement.style.opacity = "1";
    cardElement.style.border = "";
    cardElement.style.boxShadow = "";

    // Показываем ошибку
    showNotification(
      `❌ Не удалось изменить статус заказа #${orderId}: ${error.message}`,
      "error",
    );

    // Перерисовываем для гарантии консистентности
    await renderKanban();
  }
}

// ========== УСТАРЕВШАЯ ФУНКЦИЯ (для обратной совместимости) ==========
async function changeOrderStatus(orderId, newStatus, comment = "", version) {
  try {
    const cardVersion = Number(
      document.querySelector(`[data-order-id="${orderId}"]`)?.dataset.version,
    );
    await api.updateOrderStatus(
      orderId,
      newStatus,
      comment || null,
      version || cardVersion,
    );

    if (
      window.location.pathname.includes("dashboard.html") ||
      window.location.pathname.endsWith("/")
    ) {
      await renderKanban();
    }

    return true;
  } catch (error) {
    console.error("Ошибка смены статуса:", error);
    alert("❌ Не удалось изменить статус: " + error.message);
    await renderKanban();
    return false;
  }
}

// ========== СИСТЕМА УВЕДОМЛЕНИЙ ==========
function showNotification(message, type = "info") {
  // Удаляем предыдущие уведомления
  const existing = document.querySelector(".crm-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `crm-notification fixed top-4 right-4 px-6 py-4 rounded-lg shadow-2xl z-50 max-w-md transform transition-all duration-300 translate-x-full`;

  // Стили в зависимости от типа
  const styles = {
    success: "bg-emerald-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
    warning: "bg-amber-500 text-white",
  };

  notification.classList.add(...(styles[type] || styles.info).split(" "));
  const content = document.createElement("div");
  content.className = "flex items-center gap-3";
  const messageNode = document.createElement("div");
  messageNode.className = "text-lg font-bold";
  messageNode.textContent = message;
  const closeButton = document.createElement("button");
  closeButton.className =
    "ml-auto text-white hover:text-gray-200 text-xl font-bold";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => notification.remove());
  content.append(messageNode, closeButton);
  notification.appendChild(content);

  document.body.appendChild(notification);

  // Анимация появления
  setTimeout(() => {
    notification.classList.remove("translate-x-full");
    notification.classList.add("translate-x-0");
  }, 10);

  // Автоматическое исчезновение
  setTimeout(() => {
    notification.classList.remove("translate-x-0");
    notification.classList.add("translate-x-full");
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ========== ВЫХОД ИЗ СИСТЕМЫ ==========
function initGlobalUI() {
  document.getElementById("logoutBtn")?.addEventListener("click", function () {
    Store.clear();
    window.location.href = "login.html";
  });

  document
    .getElementById("newOrderBtn")
    ?.addEventListener("click", function () {
      window.location.href = "order.html";
    });

  document
    .getElementById("quickCalcBtn")
    ?.addEventListener("click", function () {
      window.open("calculator.html", "_blank");
    });

  document
    .getElementById("priceRefBtn")
    ?.addEventListener("click", function () {
      window.location.href = "admin.html";
    });

  document
    .getElementById("searchInput")
    ?.addEventListener("input", function (e) {
      const searchTerm = e.target.value.toLowerCase();
      const cards = document.querySelectorAll(".order-card");
      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? "block" : "none";
      });
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЯ ТУМБЛЕРА ==========
document.addEventListener("DOMContentLoaded", function () {
  initGlobalUI();

  const toggle = document.getElementById("hideEmptyToggle");
  if (toggle) {
    toggle.checked = false;
    toggleEmptyColumns();
  }
});
