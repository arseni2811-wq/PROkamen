document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const userNameEl = document.getElementById("userName");
  if (userNameEl) {
    userNameEl.textContent =
      currentUser.full_name || currentUser.name || "Мастер";
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("currentUser");
      window.location.href = "login.html";
    });
  }

  const queueContainer = document.getElementById("queueContainer");
  const inWorkContainer = document.getElementById("inWorkContainer");
  if (queueContainer) {
    queueContainer.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Загрузка...</div>`;
  }
  if (inWorkContainer) {
    inWorkContainer.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Загрузка...</div>`;
  }

  document.getElementById("closeFilesBtn")?.addEventListener("click", () => {
    document.getElementById("filesModal")?.classList.add("hidden");
  });

  await loadProductionData();
});

async function loadProductionData() {
  try {
    const data = await api.getOrders();
    const orders = Array.isArray(data) ? data : [];
    renderProductionBoard(orders);
  } catch (error) {
    console.error("Ошибка загрузки производственного списка:", error);
    const queueContainer = document.getElementById("queueContainer");
    const inWorkContainer = document.getElementById("inWorkContainer");
    if (queueContainer) {
      queueContainer.innerHTML = `<div class="text-center text-red-500 py-10 font-bold">${error.message}</div>`;
    }
    if (inWorkContainer) {
      inWorkContainer.innerHTML = `<div class="text-center text-red-500 py-10 font-bold">${error.message}</div>`;
    }
  }
}

function renderProductionBoard(orders) {
  const queueContainer = document.getElementById("queueContainer");
  const inWorkContainer = document.getElementById("inWorkContainer");

  if (!queueContainer || !inWorkContainer) return;

  queueContainer.innerHTML = "";
  inWorkContainer.innerHTML = "";

  const filteredOrders = orders.filter((order) =>
    ["waiting_stone", "in_production", "ready_shipping"].includes(
      order.status_id,
    ),
  );

  let queueCount = 0;
  let inWorkCount = 0;

  filteredOrders.forEach((order) => {
    if (order.status_id === "waiting_stone") {
      queueContainer.appendChild(createProductionCard(order, "queue"));
      queueCount++;
    } else if (order.status_id === "in_production") {
      inWorkContainer.appendChild(createProductionCard(order, "work"));
      inWorkCount++;
    } else if (order.status_id === "ready_shipping") {
      inWorkContainer.appendChild(createProductionCard(order, "work"));
      inWorkCount++;
    }
  });

  document.getElementById("queueCount").textContent = queueCount;
  document.getElementById("inWorkCount").textContent = inWorkCount;

  if (queueCount === 0) {
    queueContainer.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Нет заказов в очереди</div>`;
  }
  if (inWorkCount === 0) {
    inWorkContainer.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Нет заказов в работе</div>`;
  }
}

function createProductionCard(order, type) {
  const card = document.createElement("div");
  card.className =
    "bg-white border border-gray-200 rounded-lg shadow-sm p-5 transition hover:shadow-md";

  const deadlineText = order.deadline_date
    ? new Date(order.deadline_date).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      })
    : "Не задан";

  const totalAmount = Number(order.total_amount || 0).toLocaleString("ru-RU");

  card.innerHTML = `
    <div class="flex justify-between items-start border-b border-gray-100 pb-3 mb-3">
      <div>
        <div class="text-xl font-black text-gray-800">Заказ #${order.order_id}</div>
        <div class="text-xs font-bold text-gray-500">🏁 Дедлайн цеха: до ${deadlineText}</div>
      </div>
      <span class="text-[10px] text-gray-400 border border-gray-200 px-2 py-1 rounded">${type === "queue" ? "Очередь" : "В работе"}</span>
    </div>

    <div class="space-y-3 mb-4">
      <div class="bg-gray-50 p-3 rounded border border-gray-200">
        <div class="text-[10px] text-gray-500 uppercase font-bold mb-1">Клиент</div>
        <div class="font-black text-blue-900 text-base">${order.client_name || "Не указан"}</div>
      </div>
      <div class="bg-gray-50 p-3 rounded border border-gray-200">
        <div class="text-[10px] text-gray-500 uppercase font-bold mb-1">Сумма</div>
        <div class="font-black text-gray-800">${totalAmount} BYN</div>
      </div>
    </div>

    <a href="order.html?id=${order.order_id}" class="block w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-lg shadow-sm transition uppercase tracking-wide text-sm text-center">
      🔎 Открыть карточку
    </a>
  `;

  return card;
}

window.moveStatus = async function (orderId, newStatus) {
  if (!confirm("Подтвердить изменение статуса?")) return;

  try {
    await api.updateOrderStatus(orderId, newStatus);
    await loadProductionData();
  } catch (error) {
    console.error("Ошибка смены статуса:", error);
    alert(`❌ ${error.message}`);
  }
};

window.openFilesModal = function () {
  alert("Файлы временно недоступны из backend.");
};
