let calculatorAdmin = null;

const byn = (cents) => (Number(cents || 0) / 100).toFixed(2);
const html = (value) => escapeHtml(value ?? "");

function currentRate() {
  return Number(calculatorAdmin?.pricebook?.exchange_rate_scaled || 0) / 10000;
}

function renderSettings() {
  const box = document.getElementById("exchangeRateInput")?.closest(".space-y-4");
  if (!box || !calculatorAdmin) return;
  const pricebook = calculatorAdmin.pricebook;
  document.getElementById("exchangeRateInput").value = currentRate();
  box.querySelectorAll("[data-calculator-setting]").forEach((node) => node.remove());
  const fields = document.createElement("div");
  fields.dataset.calculatorSetting = "true";
  fields.className = "grid grid-cols-2 gap-3";
  fields.innerHTML = `
    <label class="text-xs text-gray-600">Резерв, %<input id="reservePercent" type="number" step="0.1" value="${Number(pricebook.reserve_bps) / 100}" class="w-full border rounded p-2 mt-1"></label>
    <label class="text-xs text-gray-600">Публичный коэффициент, %<input id="publicFactor" type="number" step="0.1" value="${Number(pricebook.public_factor_bps) / 100}" class="w-full border rounded p-2 mt-1"></label>
    <label class="text-xs text-gray-600">Отходы, %<input id="wastePercent" type="number" step="0.1" value="${Number(pricebook.waste_bps) / 100}" class="w-full border rounded p-2 mt-1"></label>
    <label class="text-xs text-gray-600">Мин. наценка материала, %<input id="minimumMarkup" type="number" step="0.1" value="${Number(pricebook.minimum_material_markup_bps) / 100}" class="w-full border rounded p-2 mt-1"></label>
    <label class="text-xs text-gray-600">Минимальный заказ, BYN<input id="minimumOrder" type="number" step="0.01" value="${byn(pricebook.minimum_order_byn_cents)}" class="w-full border rounded p-2 mt-1"></label>
    <label class="text-xs text-gray-600">Шаг округления, BYN<input id="roundingStep" type="number" step="0.01" value="${byn(pricebook.rounding_step_byn_cents)}" class="w-full border rounded p-2 mt-1"></label>
    <label class="text-xs text-gray-600 col-span-2">Публичная формулировка<input id="publicWording" value="${html(pricebook.public_wording)}" class="w-full border rounded p-2 mt-1"></label>
    <div class="col-span-2 text-xs bg-blue-50 border border-blue-200 rounded p-3">Редактируется версия <strong>${pricebook.version_number}</strong> (${pricebook.status === "draft" ? "черновик" : "опубликована"}). Новые значения начнут действовать после публикации.</div>`;
  box.insertBefore(fields, document.getElementById("saveSettingsBtn"));
  let publish = document.getElementById("publishPricebookBtn");
  if (!publish) {
    publish = document.createElement("button");
    publish.id = "publishPricebookBtn";
    publish.dataset.calculatorSetting = "true";
    publish.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded";
    publish.textContent = "Опубликовать новую версию";
    box.appendChild(publish);
    publish.addEventListener("click", publishPricebook);
  }
}

function renderRates() {
  const host = document.getElementById("servicesContainer");
  if (!host || !calculatorAdmin) return;
  host.innerHTML = calculatorAdmin.rates.map((rate) => {
    const usd = Number(rate.basePriceUsdCents) / 100;
    return `<article class="border rounded-lg p-3" data-rate="${html(rate.systemCode)}">
      <div class="font-bold">${html(rate.displayName)}</div><div class="text-[11px] text-gray-500 font-mono">${html(rate.systemCode)} · ${html(rate.category)} · ${html(rate.unit)}</div>
      <div class="grid grid-cols-2 gap-2 mt-2"><label class="text-xs">USD<input class="rate-usd w-full border rounded p-1" type="number" step="0.01" value="${usd.toFixed(2)}"></label><label class="text-xs">BYN<input class="rate-byn w-full border rounded p-1" type="number" step="0.01" value="${(usd * currentRate()).toFixed(2)}"></label></div>
      <label class="block text-xs mt-2">Название<input class="rate-name w-full border rounded p-1" value="${html(rate.displayName)}"></label>
      <div class="flex flex-wrap gap-3 mt-2 text-xs"><label><input class="rate-active" type="checkbox" ${rate.active ? "checked" : ""}> Активен</label><label><input class="rate-public" type="checkbox" ${rate.publicAvailable ? "checked" : ""}> Публичный</label><label><input class="rate-manager" type="checkbox" ${rate.managerAvailable ? "checked" : ""}> Менеджеру</label></div>
      <button class="save-rate mt-3 bg-gray-800 text-white rounded px-3 py-1 text-xs">Сохранить в черновик</button></article>`;
  }).join("");
  host.querySelectorAll("[data-rate]").forEach((row) => {
    const usd = row.querySelector(".rate-usd");
    const bynInput = row.querySelector(".rate-byn");
    usd.addEventListener("input", () => { bynInput.value = (Number(usd.value || 0) * currentRate()).toFixed(2); });
    bynInput.addEventListener("input", () => { usd.value = (Number(bynInput.value || 0) / currentRate()).toFixed(2); });
    row.querySelector(".save-rate").addEventListener("click", () => saveRate(row));
  });
}

function renderMaterials() {
  const tbody = document.getElementById("catalogTableBody");
  if (!tbody || !calculatorAdmin) return;
  document.getElementById("stoneFormWrapper")?.classList.add("hidden");
  tbody.innerHTML = calculatorAdmin.materials.filter((material) => ["quartz", "granite", "onyx", "marble"].includes(material.category)).map((material) => `<tr class="border-b" data-material="${html(material.id)}"><td class="p-3"><strong>${html(material.title)}</strong><div class="text-xs text-gray-500">${html([material.category, material.manufacturer, material.series].filter(Boolean).join(" · "))}</div></td><td class="p-3 font-mono text-xs">${html(material.id)}</td><td class="p-3">${(Number(material.basePriceUsdCents) / 100).toFixed(2)} USD<br><span class="text-xs text-emerald-700">${(Number(material.basePriceUsdCents) / 100 * currentRate()).toFixed(2)} BYN</span></td><td class="p-3 text-right text-xs">${material.active ? "Активен" : "Скрыт"}${material.publicAvailable ? " · публичный" : ""}<br><button class="edit-material text-blue-700 underline mt-1">Изменить</button></td></tr>`).join("");
  tbody.querySelectorAll(".edit-material").forEach((button) => button.addEventListener("click", () => editMaterial(button.closest("[data-material]").dataset.material)));
}

function renderFormatsAndHistory() {
  const column = document.querySelector(".lg\\:col-span-8");
  if (!column || !calculatorAdmin) return;
  document.getElementById("calculatorFormats")?.remove();
  document.getElementById("calculatorHistory")?.remove();
  const formats = document.createElement("section");
  formats.id = "calculatorFormats";
  formats.className = "bg-white rounded-xl shadow-sm border border-gray-200 p-6";
  formats.innerHTML = `<h2 class="text-lg font-bold mb-4">Форматы слэбов</h2><div class="space-y-3">${calculatorAdmin.formats.map((format) => `<div class="grid grid-cols-2 md:grid-cols-6 gap-2 items-end border rounded p-3" data-format="${html(format.system_code)}"><label class="text-xs">Название<input class="format-name w-full border rounded p-1" value="${html(format.display_name)}"></label><label class="text-xs">Длина<input class="format-length w-full border rounded p-1" type="number" value="${format.length_mm ?? ""}"></label><label class="text-xs">Ширина<input class="format-width w-full border rounded p-1" type="number" value="${format.width_mm ?? ""}"></label><label class="text-xs">Толщина<input class="format-thickness w-full border rounded p-1" type="number" value="${format.thickness_mm ?? ""}"></label><label class="text-xs"><input class="format-active" type="checkbox" ${format.is_active ? "checked" : ""}> Активен</label><button class="save-format bg-gray-800 text-white rounded px-2 py-1 text-xs">Сохранить</button></div>`).join("")}</div>`;
  formats.querySelectorAll(".save-format").forEach((button) => button.addEventListener("click", () => saveFormat(button.closest("[data-format]"))));
  column.appendChild(formats);
  const history = document.createElement("section");
  history.id = "calculatorHistory";
  history.className = "bg-white rounded-xl shadow-sm border border-gray-200 p-6";
  history.innerHTML = `<h2 class="text-lg font-bold mb-4">История изменений</h2><div class="max-h-72 overflow-auto text-sm">${calculatorAdmin.history.length ? calculatorAdmin.history.map((item) => `<div class="border-b py-2"><strong>${html(item.entityType)}: ${html(item.entityKey)}</strong><span class="text-gray-500"> · ${html(item.action)} · ${new Date(item.createdAt).toLocaleString("ru-RU")}</span></div>`).join("") : "Изменений пока нет."}</div>`;
  column.appendChild(history);
}

async function loadAdmin() {
  calculatorAdmin = await api.getCalculatorAdmin();
  renderSettings(); renderRates(); renderMaterials(); renderFormatsAndHistory();
}

async function editMaterial(id) {
  const material = calculatorAdmin.materials.find((item) => item.id === id);
  if (!material) return;
  const title = prompt("Название материала", material.title);
  if (title === null) return;
  const usd = prompt("Базовая цена USD", (Number(material.basePriceUsdCents) / 100).toFixed(2));
  if (usd === null || !Number.isFinite(Number(usd))) return;
  const publicAvailable = confirm("Показывать материал в публичном калькуляторе?");
  try {
    await api.updateCalculatorMaterial(id, { category: material.category, manufacturer: material.manufacturer, series: material.series, title: title.trim(), sku: material.sku, description: material.description, image: material.image, color: material.color, slabFormatId: material.slabFormatId, lengthMm: material.lengthMm, widthMm: material.widthMm, thicknessMm: material.thicknessMm, priceUnit: material.priceUnit, basePriceUsdCents: Math.round(Number(usd) * 100), markupBps: material.markupBps, active: material.active, publicAvailable, sortOrder: 100 });
    await loadAdmin();
  } catch (error) { alert(`❌ ${error.message}`); }
}

async function saveFormat(row) {
  const nullable = (selector) => { const value = row.querySelector(selector).value; return value === "" ? null : Number(value); };
  const original = calculatorAdmin.formats.find((item) => item.system_code === row.dataset.format);
  try {
    await api.updateCalculatorFormat(row.dataset.format, { name: row.querySelector(".format-name").value.trim(), lengthMm: nullable(".format-length"), widthMm: nullable(".format-width"), thicknessMm: nullable(".format-thickness"), active: row.querySelector(".format-active").checked, sortOrder: Number(original.sort_order || 100) });
    await loadAdmin();
  } catch (error) { alert(`❌ ${error.message}`); }
}

async function saveSettings() {
  try {
    await api.updateCalculatorSettings({
      exchangeRateScaled: Math.round(Number(document.getElementById("exchangeRateInput").value) * 10000),
      reserveBps: Math.round(Number(document.getElementById("reservePercent").value) * 100),
      publicFactorBps: Math.round(Number(document.getElementById("publicFactor").value) * 100),
      minimumOrderBynCents: Math.round(Number(document.getElementById("minimumOrder").value) * 100),
      roundingStepBynCents: Math.round(Number(document.getElementById("roundingStep").value) * 100),
      wasteBps: Math.round(Number(document.getElementById("wastePercent").value) * 100),
      minimumMaterialMarkupBps: Math.round(Number(document.getElementById("minimumMarkup").value) * 100),
      publicWording: document.getElementById("publicWording").value.trim(),
    });
    await loadAdmin(); alert("Настройки сохранены в черновик.");
  } catch (error) { alert(`❌ ${error.message}`); }
}

async function saveRate(row) {
  const existing = calculatorAdmin.rates.find((rate) => rate.systemCode === row.dataset.rate);
  try {
    await api.updateCalculatorRate(row.dataset.rate, { displayName: row.querySelector(".rate-name").value.trim(), basePriceUsdCents: Math.round(Number(row.querySelector(".rate-usd").value) * 100), publicAvailable: row.querySelector(".rate-public").checked, managerAvailable: row.querySelector(".rate-manager").checked, manualAdjustmentAllowed: existing.manualAdjustmentAllowed, active: row.querySelector(".rate-active").checked });
    await loadAdmin(); alert("Тариф сохранён в черновик.");
  } catch (error) { alert(`❌ ${error.message}`); }
}

async function publishPricebook() {
  if (!confirm("Опубликовать черновик? Новые расчёты сразу перейдут на эту версию.")) return;
  try { const result = await api.publishCalculatorPricebook(); await loadAdmin(); alert(`Опубликована версия ${result.version}.`); } catch (error) { alert(`❌ ${error.message}`); }
}

document.addEventListener("DOMContentLoaded", async () => {
  Store.initFromStorage();
  const user = Store.getUser();
  if (!user || Number(user.role_id) !== 1) { alert("Доступ разрешён только администратору."); location.href = "dashboard.html"; return; }
  document.getElementById("saveSettingsBtn")?.addEventListener("click", saveSettings);
  document.getElementById("savePricesBtn")?.classList.add("hidden");
  document.getElementById("logoutBtn")?.addEventListener("click", () => { Store.clear(); location.href = "login.html"; });
  try { await loadAdmin(); } catch (error) { alert(`❌ ${error.message}`); }
});
