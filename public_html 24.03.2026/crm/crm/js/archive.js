// =========================================================
// АРХИВ ЗАКАЗОВ: ИСТОРИЯ И АНАЛИТИКА
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const userNameEl = document.getElementById("userName");
  if (userNameEl)
    userNameEl.textContent =
      currentUser.full_name || currentUser.name || "Гость";

  const tbody = document.getElementById("archiveTableBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Загрузка...</td></tr>`;
  }

  const statsContainer = document.getElementById("archiveStats");
  if (statsContainer) {
    statsContainer.innerHTML = `<div class="text-sm text-gray-500">Загрузка...</div>`;
  }

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });

  try {
    const data = await api.getOrders();
    const orders = Array.isArray(data)
      ? data.filter((order) =>
          ["archived", "cancelled"].includes(order.status_id),
        )
      : [];

    renderArchive(orders);
  } catch (error) {
    console.error("Ошибка загрузки архива:", error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-500">${error.message}</td></tr>`;
    }
  }
});

function renderArchive(orders) {
  const tbody = document.getElementById("archiveTableBody");
  const statsContainer = document.getElementById("archiveStats");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">В архиве пока нет заказов.</td></tr>`;
    return;
  }

  let totalRevenue = 0;

  orders
    .sort((a, b) => Number(b.order_id) - Number(a.order_id))
    .forEach((order) => {
      const finalPrice = Number(order.total_amount) || 0;
      if (order.status_id === "archived") {
        totalRevenue += finalPrice;
      }

      const statusBadge =
        order.status_id === "cancelled"
          ? `<span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase">Отменен</span>`
          : `<span class="bg-gray-200 text-gray-800 text-xs font-bold px-2 py-1 rounded uppercase">Успешно закрыт</span>`;

      const tr = document.createElement("tr");
      tr.className =
        "border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors";
      tr.onclick = () =>
        (window.location.href = `order.html?id=${order.order_id}`);

      tr.innerHTML = `
        <td class="p-3 font-bold text-blue-600">#${order.order_id}</td>
        <td class="p-3 text-sm text-gray-500">${order.deadline_date ? new Date(order.deadline_date).toLocaleDateString("ru-RU") : "---"}</td>
        <td class="p-3">
          <div class="font-bold text-sm text-gray-800">${order.client_name || "Не указан"}</div>
          <div class="text-xs text-gray-500">${order.client_phone || ""}</div>
        </td>
        <td class="p-3 text-sm text-gray-600">${order.status_name || "-"}</td>
        <td class="p-3 text-sm text-gray-600">${order.total_amount ? `${Number(order.total_amount).toLocaleString("ru-RU")} BYN` : "-"}</td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-sm font-black text-gray-900">${finalPrice.toFixed(2)} BYN</td>
      `;
      tbody.appendChild(tr);
    });

  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div class="text-xs text-gray-400 font-bold uppercase mb-1">Всего успешных сделок</div>
          <div class="text-2xl font-black text-gray-800">${orders.filter((o) => o.status_id === "archived").length} шт.</div>
        </div>
        <div class="bg-gray-800 p-4 rounded-xl shadow-sm">
          <div class="text-xs text-gray-400 font-bold uppercase mb-1">Общая выручка за всё время</div>
          <div class="text-2xl font-black text-yellow-400">${totalRevenue.toLocaleString("ru-RU")} BYN</div>
        </div>
      </div>
    `;
  }
}
