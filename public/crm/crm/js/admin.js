// =========================================================
// АДМИН-ПАНЕЛЬ: УПРАВЛЕНИЕ СПРАВОЧНИКАМИ И НАСТРОЙКАМИ
// =========================================================
const defaultServices = {
  cutStraight: 5,
  cut45: 10,
  edge20: 20,
  edge40: 40,
  sinkUnder: 85,
  sinkTop: 40,
  joint: 40,
  hole: 10,
  plinth: 10,
};

let editingStoneId = null;
let catalogData = [];
let servicesPrices = { ...defaultServices };

function initSettings() {
  const settings = Store.getSettings();
  const rateInput = document.getElementById("exchangeRateInput");
  if (rateInput) rateInput.value = settings.exchangeRate || 3.2;

  document
    .getElementById("saveSettingsBtn")
    ?.addEventListener("click", async () => {
      const rate = parseFloat(
        document.getElementById("exchangeRateInput").value,
      );
      if (isNaN(rate)) return alert("Введите корректный курс!");

      try {
        await api.updateSettings({ exchangeRate: rate });
        Store.setSettings({ exchangeRate: rate });
        alert("Настройки системы успешно сохранены!");
      } catch (error) {
        alert(`❌ Ошибка сохранения: ${error.message}`);
      }
    });
}

async function loadReferenceData() {
  try {
    const [materialsData, servicesData] = await Promise.all([
      api.getMaterials(),
      api.getServices(),
    ]);

    catalogData = Array.isArray(materialsData.materials)
      ? materialsData.materials
      : [];
    servicesPrices = servicesData.services ||
      servicesData || { ...defaultServices };
    renderCatalog();
    renderPrices();
  } catch (error) {
    console.error("Ошибка загрузки справочников:", error);
    alert(`❌ ${error.message}`);
  }
}

function renderCatalog() {
  const tbody = document.getElementById("catalogTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (catalogData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Каталог пуст. Добавьте первый камень.</td></tr>`;
    return;
  }

  catalogData.forEach((stone) => {
    const tr = document.createElement("tr");
    tr.className =
      "border-b border-gray-100 hover:bg-gray-50 transition-colors";
    tr.innerHTML = `
      <td class="p-3 font-bold text-gray-800">${stone.title}</td>
      <td class="p-3 text-sm text-gray-600 font-mono">${stone.material_id}</td>
      <td class="p-3 text-sm font-bold text-emerald-600">${Number(stone.price_per_m2 || 0).toFixed(2)} BYN/м²</td>
      <td class="p-3 text-right space-x-2">
        <button onclick="editStone('${stone.material_id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors text-xs font-bold">✏️ Изменить</button>
        <button onclick="deleteStone('${stone.material_id}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors text-xs font-bold">🗑 Удалить</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editStone(stoneId) {
  const stone = catalogData.find(
    (s) => String(s.material_id) === String(stoneId),
  );
  if (!stone) return;

  const idInput = document.getElementById("newStoneId");
  const titleInput = document.getElementById("newStoneTitle");
  const priceInput = document.getElementById("newStonePriceHalf");
  const fabricatorInput = document.getElementById("newStoneFabricator");

  if (idInput) idInput.value = stone.material_id;
  if (titleInput) titleInput.value = stone.title || "";
  if (priceInput) priceInput.value = stone.price_per_m2 || 0;
  if (fabricatorInput) fabricatorInput.value = stone.fabricator || "";

  editingStoneId = stoneId;

  const stoneFormTitle = document.getElementById("stoneFormTitle");
  if (stoneFormTitle) stoneFormTitle.textContent = "Редактирование камня";
  document
    .getElementById("stoneFormWrapper")
    ?.classList.add("bg-yellow-50", "border-yellow-200");
  const submitBtn = document.getElementById("submitStoneBtn");
  if (submitBtn) {
    submitBtn.textContent = "💾 Сохранить изменения";
    submitBtn.classList.replace("bg-emerald-600", "bg-yellow-500");
    submitBtn.classList.replace("hover:bg-emerald-700", "hover:bg-yellow-600");
  }
  document.getElementById("cancelEditStoneBtn")?.classList.remove("hidden");
  document
    .getElementById("stoneFormWrapper")
    ?.scrollIntoView({ behavior: "smooth" });
}

function resetStoneForm() {
  editingStoneId = null;
  document.getElementById("addStoneForm")?.reset();
  const idInput = document.getElementById("newStoneId");
  if (idInput) idInput.disabled = false;

  const stoneFormTitle = document.getElementById("stoneFormTitle");
  if (stoneFormTitle)
    stoneFormTitle.textContent = "Добавить новый камень в базу";
  document
    .getElementById("stoneFormWrapper")
    ?.classList.remove("bg-yellow-50", "border-yellow-200");
  const submitBtn = document.getElementById("submitStoneBtn");
  if (submitBtn) {
    submitBtn.textContent = "+ Добавить в каталог";
    submitBtn.classList.replace("bg-yellow-500", "bg-emerald-600");
    submitBtn.classList.replace("hover:bg-yellow-600", "hover:bg-emerald-700");
  }
  document.getElementById("cancelEditStoneBtn")?.classList.add("hidden");
}

async function handleAddOrUpdateStone(e) {
  e.preventDefault();
  const idInput = document.getElementById("newStoneId")?.value.trim() || "";
  const titleInput =
    document.getElementById("newStoneTitle")?.value.trim() || "";
  const priceInput =
    parseFloat(document.getElementById("newStonePriceHalf")?.value) || 0;
  const fabricatorInput =
    document.getElementById("newStoneFabricator")?.value.trim() || "";

  if (!titleInput) return alert("Заполните название камня!");

  try {
    const payload = {
      material_id: idInput || undefined,
      type_id: 1,
      title: titleInput,
      fabricator: fabricatorInput,
      price_per_m2: priceInput,
    };

    if (editingStoneId) {
      await api.updateMaterial(editingStoneId, payload);
    } else {
      await api.createMaterial(payload);
    }

    await loadReferenceData();
    alert(
      editingStoneId
        ? "Камень успешно обновлен в базе!"
        : "Камень успешно добавлен в базу!",
    );
    resetStoneForm();
  } catch (error) {
    console.error("Ошибка сохранения камня:", error);
    alert(`❌ ${error.message}`);
  }
}

async function deleteStone(stoneId) {
  if (!confirm(`Точно удалить камень ${stoneId}?`)) return;

  try {
    await api.deleteMaterial(stoneId);
    await loadReferenceData();
    if (editingStoneId === stoneId) resetStoneForm();
    alert("Камень успешно удален из базы!");
  } catch (error) {
    console.error("Ошибка удаления камня:", error);
    alert(`❌ ${error.message}`);
  }
}

const serviceNamesMap = {
  cutStraight: "Прямой рез (м.п.)",
  cut45: "Рез под 45° (м.п.)",
  edge20: "Торец 20 мм (м.п.)",
  edge40: "Торец 40 мм (м.п.)",
  sinkUnder: "Мойка подклейка (шт)",
  sinkTop: "Накладная / Варочная (шт)",
  joint: "Стык деталей (шт)",
  hole: "Отверстие (шт)",
  plinth: "Плинтус (м.п.)",
};

function renderPrices() {
  const prices = { ...defaultServices, ...servicesPrices };
  const container = document.getElementById("servicesContainer");
  if (!container) return;

  container.innerHTML = "";
  Object.keys(prices).forEach((key) => {
    const isSystem = Object.prototype.hasOwnProperty.call(serviceNamesMap, key);
    const displayName = isSystem ? serviceNamesMap[key] : key;

    container.innerHTML += `
      <div class="flex justify-between items-center p-1 hover:bg-gray-50 rounded">
        <span class="text-gray-600 ${isSystem ? "" : "text-blue-700 font-medium"}">${displayName}</span>
        <div class="flex items-center gap-2">
          <input type="number" id="price_${key}" value="${prices[key]}" class="w-16 border-gray-300 border rounded p-1 text-center font-bold focus:border-yellow-500 outline-none">
          ${!isSystem ? `<button onclick="deleteCustomService('${key}')" class="text-red-400 hover:text-red-600 text-lg font-bold" title="Удалить услугу">&times;</button>` : `<span class="w-4"></span>`}
        </div>
      </div>
    `;
  });
}

async function saveAllPrices() {
  try {
    const updatedPrices = {};
    Object.keys(servicesPrices).forEach((key) => {
      const input = document.getElementById(`price_${key}`);
      updatedPrices[key] = input
        ? parseFloat(input.value) || 0
        : servicesPrices[key];
    });

    const data = await api.updateServices(updatedPrices);
    servicesPrices = data.services || updatedPrices;
    renderPrices();
    alert("Прайс-лист успешно сохранен в базу!");
  } catch (error) {
    console.error("Ошибка сохранения прайса:", error);
    alert(`❌ ${error.message}`);
  }
}

async function addCustomService(e) {
  e.preventDefault();
  const name = document.getElementById("newServiceName")?.value.trim() || "";
  const price = parseFloat(document.getElementById("newServicePrice")?.value);

  if (!name || Number.isNaN(price))
    return alert("Укажите название услуги и цену!");
  if (
    Object.prototype.hasOwnProperty.call(servicesPrices, name) ||
    Object.prototype.hasOwnProperty.call(serviceNamesMap, name)
  ) {
    return alert("Услуга с таким названием уже существует!");
  }

  servicesPrices[name] = price;
  await saveAllPrices();

  document.getElementById("newServiceName").value = "";
  document.getElementById("newServicePrice").value = "";
}

async function deleteCustomService(key) {
  if (!confirm(`Удалить услугу "${key}"?`)) return;
  if (Object.prototype.hasOwnProperty.call(serviceNamesMap, key)) {
    return alert("Системную услугу удалить нельзя");
  }

  delete servicesPrices[key];
  await saveAllPrices();
}

function setupEventListeners() {
  document
    .getElementById("addStoneForm")
    ?.addEventListener("submit", handleAddOrUpdateStone);
  document
    .getElementById("cancelEditStoneBtn")
    ?.addEventListener("click", resetStoneForm);
  document
    .getElementById("savePricesBtn")
    ?.addEventListener("click", saveAllPrices);
  document
    .getElementById("addCustomServiceBtn")
    ?.addEventListener("click", addCustomService);
}

document.addEventListener("DOMContentLoaded", async () => {
  Store.initFromStorage();
  const currentUser = Store.getUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "director")
  ) {
    alert("Доступ запрещен. Недостаточно прав.");
    window.location.href = "dashboard.html";
    return;
  }

  initSettings();
  setupEventListeners();
  await loadReferenceData();

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    Store.clear();
    window.location.href = "login.html";
  });
});
