document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const userNameEl = document.getElementById("userName");
  if (userNameEl) {
    userNameEl.textContent =
      currentUser.full_name || currentUser.name || "Гость";
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("crm_token");
      window.location.href = "login.html";
    });
  }

  const tbody = document.getElementById("clientsTableBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">Загрузка...</td></tr>`;
  }

  const statsContainer = document.getElementById("clientsStats");
  if (statsContainer) {
    statsContainer.innerHTML = `<div class="text-sm text-gray-500">Загрузка...</div>`;
  }

  let clientsData = [];

  document
    .getElementById("searchClientInput")
    ?.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = clientsData.filter(
        (client) =>
          (client.full_name || "").toLowerCase().includes(term) ||
          (client.phone || "").toLowerCase().includes(term) ||
          (client.email || "").toLowerCase().includes(term),
      );
      renderClients(filtered);
    });

  document.getElementById("closeModalBtn")?.addEventListener("click", () => {
    document.getElementById("clientHistoryModal")?.classList.add("hidden");
  });

  try {
    const data = await api.getClients();
    clientsData = Array.isArray(data) ? data : [];
    renderClients(clientsData);
    renderStats(clientsData);
  } catch (error) {
    console.error("Ошибка загрузки клиентов:", error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">${error.message}</td></tr>`;
    }
  }
});

function renderStats(clientsData) {
  const statsContainer = document.getElementById("clientsStats");
  if (!statsContainer) return;

  const totalClients = clientsData.length;
  const totalRevenueAll = clientsData.reduce(
    (sum, client) => sum + (Number(client.totalRevenue) || 0),
    0,
  );

  statsContainer.innerHTML = `
    <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
      <div>
        <div class="text-xs text-gray-400 font-bold uppercase mb-1">Всего клиентов</div>
        <div class="text-2xl font-black text-gray-800">${totalClients}</div>
      </div>
      <div class="text-3xl opacity-20">👥</div>
    </div>
    <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
      <div>
        <div class="text-xs text-gray-400 font-bold uppercase mb-1">Общая база</div>
        <div class="text-2xl font-black text-emerald-600">${totalClients} записей</div>
      </div>
      <div class="text-3xl opacity-20">💼</div>
    </div>
    <div class="bg-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between">
      <div>
        <div class="text-xs text-gray-400 font-bold uppercase mb-1">Сумма данных</div>
        <div class="text-2xl font-black text-[#D4AF37]">${totalRevenueAll.toLocaleString("ru-RU")} BYN</div>
      </div>
      <div class="text-3xl opacity-20">📈</div>
    </div>
  `;
}

function renderClients(clientsData) {
  const tbody = document.getElementById("clientsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (clientsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">Клиенты не найдены.</td></tr>`;
    return;
  }

  clientsData.forEach((client, index) => {
    let topBadge = "";
    if (index === 0) topBadge = "🥇 ";
    else if (index === 1) topBadge = "🥈 ";
    else if (index === 2) topBadge = "🥉 ";

    const tr = document.createElement("tr");
    tr.className =
      "border-b border-gray-100 hover:bg-gray-50 transition-colors";
    tr.innerHTML = `
      <td class="p-4">
        <div class="font-bold text-gray-800 text-sm">${topBadge}${client.full_name || "Не указано"}</div>
      </td>
      <td class="p-4">
        <div class="text-sm font-medium text-gray-700">${client.phone || "---"}</div>
        <div class="text-xs text-gray-400">${client.email || ""}</div>
      </td>
      <td class="p-4 text-center">
        <span class="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">${client.client_id || "—"}</span>
      </td>
      <td class="p-4 text-right">
        <div class="font-black text-gray-900">${Number(client.totalRevenue || 0).toLocaleString("ru-RU")} BYN</div>
      </td>
      <td class="p-4 text-center">
        <button onclick='openClientHistory(${JSON.stringify(client).replace(/'/g, "&#39;")})' class="text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded transition text-xs font-bold">
          📂 Детали
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openClientHistory = function (client) {
  document.getElementById("modalClientName").textContent =
    client.full_name || "Клиент";
  const list = document.getElementById("modalOrdersList");
  if (list) {
    list.innerHTML = `
      <div class="text-sm text-gray-500 text-center py-4">
        История заказов по этому клиенту пока не загружается из backend.
      </div>
    `;
  }
  document.getElementById("clientHistoryModal")?.classList.remove("hidden");
};
