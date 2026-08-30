(function () {
  "use strict";

  const root = document.getElementById("calculatorApp");
  if (!root) return;
  const internal = document.documentElement.dataset.calculatorMode === "internal";
  const params = new URLSearchParams(location.search);
  const orderId = internal ? params.get("orderId") : null;
  const apiOrigin = ["5500", "5501"].includes(location.port)
    ? `${location.protocol}//${location.hostname}:3000`
    : location.origin;
  const money = (cents) => `${(Number(cents || 0) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const defaultItem = () => ({ productType: "countertop", shape: "straight", pieces: [{ lengthMm: 2900, widthMm: 600 }], edgeCode: "edge_standard", processedEdgeM: 2.9, operations: [] });
  const state = {
    catalog: null,
    materialId: "",
    slabFormatCode: "normal",
    customFormat: { lengthMm: 3050, widthMm: 1440, thicknessMm: 20 },
    items: [defaultItem()],
    operations: {},
    additionalLines: [],
    manualSlabCount: null,
    manualMaterialPriceUsdCents: 0,
    materialMarkupBps: 0,
    additionalMaterialBynCents: 0,
    managerAdjustmentBynCents: 0,
    calculation: null,
    orderVersion: null,
    timer: null,
  };

  function request(path, options = {}) {
    const token = localStorage.getItem("crm_token");
    return fetch(`${apiOrigin}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(internal && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Ошибка ${response.status}`);
      return data;
    });
  }

  function renderShell() {
    root.innerHTML = `
      <section class="calc-panel">
        <div class="calc-section"><h2>1. Изделия и размеры</h2><div id="items"></div><button class="btn btn--ghost" id="addItem" type="button">+ Добавить изделие</button></div>
        <div class="calc-section"><h2>Схема</h2><svg id="shapePreview" class="svg-preview" viewBox="0 0 520 180" role="img" aria-label="Схема формы изделия"></svg></div>
        <div class="calc-section"><h2>2. Материал</h2>
          <div class="calc-row"><label class="calc-field">Категория<select id="categoryFilter"><option value="">Все</option></select></label><label class="calc-field">Производитель<select id="manufacturerFilter"><option value="">Все</option></select></label></div>
          <label class="calc-field" style="margin:12px 0">Серия<select id="seriesFilter"><option value="">Все</option></select></label>
          <div id="materials" class="calc-materials"></div>
          <div class="calc-row" style="margin-top:14px"><label class="calc-field">Формат слэба<select id="slabFormat"></select></label><label class="calc-field">Толщина, мм<input id="thickness" type="number" min="5" max="200" value="20" /></label></div>
          <div id="customFormat" class="calc-row hidden" style="margin-top:10px"><label class="calc-field">Длина слэба, мм<input id="customLength" type="number" value="3050" /></label><label class="calc-field">Ширина слэба, мм<input id="customWidth" type="number" value="1440" /></label></div>
        </div>
        <div class="calc-section"><h2>3. Обработка, вырезы и монтаж</h2><div id="operations" class="operation-grid"></div></div>
        ${internal ? `<div class="calc-section"><h2>4. Корректировки менеджера</h2>
          <div class="calc-row"><label class="calc-field">Расход слэбов вручную (шаг 0,5)<input id="manualSlabs" type="number" min="0" step="0.5" placeholder="Авто" /></label><label class="calc-field">Цена своего материала, USD<input id="manualMaterialPrice" type="number" min="0" step="0.01" value="0" /></label><label class="calc-field">Наценка материала, %<input id="materialMarkup" type="number" min="0" step="0.1" value="0" /></label><label class="calc-field">Доп. стоимость материала, BYN<input id="materialExtra" type="number" min="0" step="0.01" value="0" /></label><label class="calc-field">Скидка / надбавка, BYN<input id="managerAdjustment" type="number" step="0.01" value="0" /></label></div>
          <div id="manualLines"></div><button class="btn btn--ghost" id="addManualLine" type="button">+ Дополнительная услуга</button></div>` : `<div class="calc-section"><h2>4. Получить расчёт</h2><div class="calc-row"><label class="calc-field">Имя<input id="leadName" autocomplete="name" /></label><label class="calc-field">Телефон<input id="leadPhone" autocomplete="tel" /></label></div><label class="calc-field" style="margin-top:12px">Email<input id="leadEmail" type="email" autocomplete="email" /></label><label class="calc-field" style="margin-top:12px">Комментарий<textarea id="leadComment" rows="3"></textarea></label></div>`}
      </section>
      <aside class="calc-summary"><div>Расчёт</div><div id="summaryPrice" class="summary-price">—</div><ul id="summaryLines" class="summary-lines"></ul><div id="internalTotals" class="summary-internal hidden"></div><div id="status" class="status"></div><button class="btn btn--gold" id="primaryAction" type="button" disabled>${internal ? (orderId ? "Сохранить в заказе" : "Скопировать смету") : "Отправить заявку"}</button></aside>`;
  }

  function renderItems() {
    const edgeOptions = (state.catalog?.operations || [])
      .filter((operation) => operation.category === "edge")
      .map((operation) => ({ code: operation.code, name: operation.name }));
    document.getElementById("items").innerHTML = state.items.map((item, index) => `
      <article class="item-card" data-item="${index}"><div class="item-head"><strong>Изделие ${index + 1}</strong>${state.items.length > 1 ? `<button type="button" class="btn--danger remove-item">Удалить</button>` : ""}</div>
      <div class="calc-row"><label class="calc-field">Тип<select class="item-product"><option value="countertop" ${item.productType === "countertop" ? "selected" : ""}>Столешница</option><option value="windowsill" ${item.productType === "windowsill" ? "selected" : ""}>Подоконник</option></select></label><label class="calc-field">Форма<select class="item-shape"><option value="straight" ${item.shape === "straight" ? "selected" : ""}>Прямая</option><option value="l" ${item.shape === "l" ? "selected" : ""}>Г-образная</option><option value="u" ${item.shape === "u" ? "selected" : ""}>П-образная</option></select></label></div>
      <div class="pieces">${item.pieces.map((piece, pieceIndex) => `<div class="piece-grid"><label class="calc-field">Участок ${pieceIndex + 1}: длина, мм<input class="piece-length" data-piece="${pieceIndex}" type="number" min="1" max="20000" value="${piece.lengthMm}" /></label><label class="calc-field">Ширина, мм<input class="piece-width" data-piece="${pieceIndex}" type="number" min="1" max="5000" value="${piece.widthMm}" /></label></div>`).join("")}</div>
      <div class="calc-row" style="margin-top:10px"><label class="calc-field">Вид кромки<select class="item-edge-code">${edgeOptions.map((edge) => `<option value="${escape(edge.code)}" ${item.edgeCode === edge.code ? "selected" : ""}>${escape(edge.name)}</option>`).join("")}</select></label><label class="calc-field">Длина обрабатываемой кромки, м<input class="item-edge" type="number" min="0" step="0.1" value="${item.processedEdgeM || 0}" /></label></div></article>`).join("");
    updateSvg();
  }

  function renderCatalogFilters() {
    const { categories, materials, formats } = state.catalog;
    document.getElementById("categoryFilter").innerHTML = `<option value="">Все</option>${categories.map((item) => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("")}`;
    const unique = (key) => [...new Set(materials.map((item) => item[key]).filter(Boolean))].sort();
    document.getElementById("manufacturerFilter").innerHTML = `<option value="">Все</option>${unique("manufacturer").map((value) => `<option>${escape(value)}</option>`).join("")}`;
    document.getElementById("seriesFilter").innerHTML = `<option value="">Все</option>${unique("series").map((value) => `<option>${escape(value)}</option>`).join("")}`;
    document.getElementById("slabFormat").innerHTML = formats.map((format) => `<option value="${escape(format.code)}">${escape(format.name)}${format.custom ? " — свои размеры" : ` — ${format.lengthMm}×${format.widthMm}×${format.thicknessMm} мм`}</option>`).join("");
    renderMaterials();
    document.getElementById("operations").innerHTML = state.catalog.operations
      .filter((operation) => operation.code !== "cut_straight" && operation.category !== "edge")
      .map((operation) => `<label class="operation"><span>${escape(operation.name)} <small>(${escape(operation.unit)})</small></span><input type="number" min="0" step="${operation.unit === "m" || operation.unit === "sqm" ? "0.1" : "1"}" value="0" data-operation="${escape(operation.code)}" /></label>`).join("");
  }

  function renderMaterials() {
    const category = document.getElementById("categoryFilter").value;
    const manufacturer = document.getElementById("manufacturerFilter").value;
    const series = document.getElementById("seriesFilter").value;
    const list = state.catalog.materials.filter((item) => (!category || item.category === category) && (!manufacturer || item.manufacturer === manufacturer) && (!series || item.series === series));
    document.getElementById("materials").innerHTML = list.length ? list.map((item) => `<button class="material-card ${state.materialId === item.id ? "selected" : ""}" type="button" data-material="${escape(item.id)}">${item.image ? `<img src="${escape(new URL(item.image, apiOrigin).href)}" alt="" loading="lazy" />` : `<div style="aspect-ratio:4/3;background:#e7e4dc"></div>`}<div><strong>${escape(item.title)}</strong><small>${escape([item.manufacturer, item.series].filter(Boolean).join(" · "))}</small></div></button>`).join("") : `<p>Материалы по фильтру не найдены.</p>`;
  }

  function renderManualLines() {
    const host = document.getElementById("manualLines");
    if (!host) return;
    host.innerHTML = state.additionalLines.map((line, index) => `<div class="manual-line" data-line="${index}"><div class="item-head"><strong>Дополнительная строка ${index + 1}</strong><button type="button" class="btn--danger remove-line">Удалить</button></div><div class="calc-row"><label class="calc-field">Название<input class="line-name" value="${escape(line.name)}" /></label><label class="calc-field">Количество<input class="line-quantity" type="number" min="0" step="0.1" value="${line.quantity}" /></label><label class="calc-field">Единица<input class="line-unit" value="${escape(line.unit)}" /></label><label class="calc-field">Цена за единицу, BYN<input class="line-price" type="number" min="0" step="0.01" value="${line.unitPriceCents / 100}" /></label></div><label class="calc-field" style="margin-top:10px">Комментарий<input class="line-comment" value="${escape(line.comment || "")}" /></label></div>`).join("");
  }

  function updateSvg() {
    const svg = document.getElementById("shapePreview");
    if (!svg) return;
    const shape = state.items[0]?.shape || "straight";
    const path = shape === "u" ? "M70 135V40h95v55h190V40h95v95H70Z" : shape === "l" ? "M70 45h380v70H180v30H70V45Z" : "M55 55h410v75H55Z";
    svg.innerHTML = `<path d="${path}" fill="#d8d3c8" stroke="#8b784f" stroke-width="4" style="transition:all .25s ease"/><text x="260" y="165" text-anchor="middle" fill="#6f706b" font-size="14">${shape === "u" ? "П-образная" : shape === "l" ? "Г-образная" : "Прямая"} форма</text>`;
  }

  function configuration() {
    return {
      items: state.items.map((item) => ({ ...item, operations: [] })),
      operations: Object.entries(state.operations).filter(([, quantity]) => Number(quantity) > 0).map(([code, quantity]) => ({ code, quantity: Number(quantity) })),
      additionalLines: internal ? state.additionalLines : [],
      manualSlabCount: internal ? state.manualSlabCount : null,
      manualMaterialPriceUsdCents: internal ? state.manualMaterialPriceUsdCents : 0,
      materialMarkupBps: internal ? state.materialMarkupBps : 0,
      additionalMaterialBynCents: internal ? state.additionalMaterialBynCents : 0,
      managerAdjustmentBynCents: internal ? state.managerAdjustmentBynCents : 0,
    };
  }

  function payload() {
    return {
      materialId: state.materialId,
      slabFormatCode: state.slabFormatCode,
      ...(state.slabFormatCode === "custom" ? { customFormat: state.customFormat } : {}),
      configuration: configuration(),
    };
  }

  function scheduleCalculate() {
    clearTimeout(state.timer);
    state.timer = setTimeout(calculate, 280);
  }

  async function calculate() {
    if (!state.materialId) return showStatus("Выберите материал.");
    showStatus("Рассчитываем…");
    try {
      const result = await request(internal ? "/api/calculator/preview" : "/api/public/calculator/preview", { method: "POST", body: JSON.stringify(payload()) });
      state.calculation = result.calculation;
      renderSummary();
      showStatus("Расчёт актуален.");
      document.getElementById("primaryAction").disabled = false;
    } catch (error) {
      state.calculation = null;
      document.getElementById("primaryAction").disabled = true;
      showStatus(error.message, true);
    }
  }

  function renderSummary() {
    const calculation = state.calculation;
    if (!calculation) return;
    const totalCents = internal ? calculation.totals.finalQuoteTotalCents : calculation.publicFromTotalCents;
    document.getElementById("summaryPrice").textContent = `${internal ? "" : `${calculation.wording} `}${money(totalCents)}`;
    const lines = internal ? calculation.lines : [];
    document.getElementById("summaryLines").innerHTML = internal
      ? [`<li><span>Материал (${calculation.material.slabCount} слэба)</span><strong>${money(calculation.totals.materialBynCents)}</strong></li>`, ...lines.filter((line) => Number(line.amountBynCents) > 0).map((line) => `<li><span>${escape(line.name)} × ${line.quantity}</span><strong>${money(line.amountBynCents)}</strong></li>`)].join("")
      : `<li><span>Площадь изделия</span><strong>${Number(calculation.metrics.areaM2).toLocaleString("ru-RU")} м²</strong></li>`;
    const box = document.getElementById("internalTotals");
    if (internal) {
      box.classList.remove("hidden");
      box.innerHTML = `Техническая сумма: <strong>${money(calculation.totals.technicalTotalCents)}</strong><br>Резерв: <strong>${money(calculation.totals.reserveCents)}</strong><br>Рекомендуемая цена: <strong>${money(calculation.totals.recommendedManagerTotalCents)}</strong><br>Версия прайса: <strong>${calculation.pricebookVersion}</strong>`;
    }
  }

  function showStatus(message, error = false) {
    const node = document.getElementById("status");
    node.textContent = message || "";
    node.classList.toggle("error", error);
  }

  async function primaryAction() {
    if (!state.calculation) return;
    const button = document.getElementById("primaryAction");
    button.disabled = true;
    try {
      if (!internal) {
        const contact = {
          name: document.getElementById("leadName").value.trim(),
          phone: document.getElementById("leadPhone").value.trim(),
          email: document.getElementById("leadEmail").value.trim(),
          comment: document.getElementById("leadComment").value.trim(),
        };
        const result = await request("/api/public/calculator/leads", { method: "POST", body: JSON.stringify({ ...payload(), contact }) });
        showStatus(`Заявка №${result.leadId} отправлена. Менеджер свяжется с вами.`);
      } else if (orderId) {
        const result = await request(`/api/orders/${encodeURIComponent(orderId)}/calculator`, { method: "PUT", body: JSON.stringify({ version: state.orderVersion, total_amount: state.calculation.totals.finalQuoteTotalCents / 100, exchange_rate: state.calculation.exchangeRate, calculator_snapshot: state.calculation }) });
        state.orderVersion = result.version;
        showStatus("Расчёт сохранён в заказе.");
      } else {
        await navigator.clipboard.writeText(document.querySelector(".calc-summary").innerText);
        showStatus("Смета скопирована.");
      }
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function bind() {
    document.getElementById("addItem").addEventListener("click", () => { state.items.push(defaultItem()); renderItems(); scheduleCalculate(); });
    document.getElementById("items").addEventListener("input", (event) => {
      const card = event.target.closest("[data-item]"); if (!card) return;
      const item = state.items[Number(card.dataset.item)];
      if (event.target.matches(".piece-length")) item.pieces[Number(event.target.dataset.piece)].lengthMm = Number(event.target.value);
      if (event.target.matches(".piece-width")) item.pieces[Number(event.target.dataset.piece)].widthMm = Number(event.target.value);
      if (event.target.matches(".item-edge")) item.processedEdgeM = Number(event.target.value);
      scheduleCalculate();
    });
    document.getElementById("items").addEventListener("change", (event) => {
      const card = event.target.closest("[data-item]"); if (!card) return;
      const index = Number(card.dataset.item); const item = state.items[index];
      if (event.target.matches(".item-product")) item.productType = event.target.value;
      if (event.target.matches(".item-edge-code")) item.edgeCode = event.target.value;
      if (event.target.matches(".item-shape")) { item.shape = event.target.value; const count = item.shape === "u" ? 3 : item.shape === "l" ? 2 : 1; while (item.pieces.length < count) item.pieces.push({ ...item.pieces[0] }); item.pieces = item.pieces.slice(0, count); renderItems(); }
      scheduleCalculate();
    });
    document.getElementById("items").addEventListener("click", (event) => { if (!event.target.matches(".remove-item")) return; state.items.splice(Number(event.target.closest("[data-item]").dataset.item), 1); renderItems(); scheduleCalculate(); });
    ["categoryFilter", "manufacturerFilter", "seriesFilter"].forEach((id) => document.getElementById(id).addEventListener("change", renderMaterials));
    document.getElementById("materials").addEventListener("click", (event) => { const card = event.target.closest("[data-material]"); if (!card) return; state.materialId = card.dataset.material; renderMaterials(); scheduleCalculate(); });
    document.getElementById("slabFormat").addEventListener("change", (event) => { state.slabFormatCode = event.target.value; document.getElementById("customFormat").classList.toggle("hidden", state.slabFormatCode !== "custom"); scheduleCalculate(); });
    document.getElementById("operations").addEventListener("input", (event) => { if (event.target.dataset.operation) { state.operations[event.target.dataset.operation] = Number(event.target.value); scheduleCalculate(); } });
    ["customLength", "customWidth", "thickness"].forEach((id) => document.getElementById(id).addEventListener("input", () => { state.customFormat.lengthMm = Number(document.getElementById("customLength").value); state.customFormat.widthMm = Number(document.getElementById("customWidth").value); state.customFormat.thicknessMm = Number(document.getElementById("thickness").value); scheduleCalculate(); }));
    if (internal) bindInternal();
    document.getElementById("primaryAction").addEventListener("click", primaryAction);
  }

  function bindInternal() {
    document.getElementById("manualSlabs").addEventListener("input", (event) => { state.manualSlabCount = event.target.value === "" ? null : Number(event.target.value); scheduleCalculate(); });
    document.getElementById("manualMaterialPrice").addEventListener("input", (event) => { state.manualMaterialPriceUsdCents = Math.round(Number(event.target.value) * 100); scheduleCalculate(); });
    document.getElementById("materialMarkup").addEventListener("input", (event) => { state.materialMarkupBps = Math.round(Number(event.target.value) * 100); scheduleCalculate(); });
    document.getElementById("materialExtra").addEventListener("input", (event) => { state.additionalMaterialBynCents = Math.round(Number(event.target.value) * 100); scheduleCalculate(); });
    document.getElementById("managerAdjustment").addEventListener("input", (event) => { state.managerAdjustmentBynCents = Math.round(Number(event.target.value) * 100); scheduleCalculate(); });
    document.getElementById("addManualLine").addEventListener("click", () => { state.additionalLines.push({ name: "Дополнительная услуга", quantity: 1, unit: "услуга", unitPriceCents: 0, currency: "BYN", category: "additional", comment: "" }); renderManualLines(); });
    document.getElementById("manualLines").addEventListener("input", (event) => { const card = event.target.closest("[data-line]"); if (!card) return; const line = state.additionalLines[Number(card.dataset.line)]; if (event.target.matches(".line-name")) line.name = event.target.value; if (event.target.matches(".line-quantity")) line.quantity = Number(event.target.value); if (event.target.matches(".line-unit")) line.unit = event.target.value; if (event.target.matches(".line-price")) line.unitPriceCents = Math.round(Number(event.target.value) * 100); if (event.target.matches(".line-comment")) line.comment = event.target.value; scheduleCalculate(); });
    document.getElementById("manualLines").addEventListener("click", (event) => { if (!event.target.matches(".remove-line")) return; state.additionalLines.splice(Number(event.target.closest("[data-line]").dataset.line), 1); renderManualLines(); scheduleCalculate(); });
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 2) return;
    state.items = snapshot.configuration?.items || state.items;
    state.operations = Object.fromEntries((snapshot.configuration?.operations || []).map((item) => [item.code, item.quantity]));
    state.additionalLines = snapshot.configuration?.additionalLines || [];
    state.manualSlabCount = snapshot.configuration?.manualSlabCount ?? null;
    state.manualMaterialPriceUsdCents = snapshot.configuration?.manualMaterialPriceUsdCents || 0;
    state.materialMarkupBps = snapshot.configuration?.materialMarkupBps || 0;
    state.additionalMaterialBynCents = snapshot.configuration?.additionalMaterialBynCents || 0;
    state.managerAdjustmentBynCents = snapshot.configuration?.managerAdjustmentBynCents || 0;
    state.materialId = snapshot.material?.id || "";
    state.slabFormatCode = snapshot.material?.slabFormat?.code || "normal";
  }

  async function init() {
    renderShell();
    try {
      const [catalog, orderResponse] = await Promise.all([
        request(internal ? "/api/calculator/catalog" : "/api/public/calculator/catalog"),
        orderId ? request(`/api/orders/${encodeURIComponent(orderId)}`) : Promise.resolve(null),
      ]);
      state.catalog = catalog;
      if (orderResponse?.order) { state.orderVersion = orderResponse.order.version; restoreSnapshot(orderResponse.order.calculator_snapshot); document.getElementById("calculatorBack").href = `order.html?id=${encodeURIComponent(orderId)}`; }
      if (!state.materialId) state.materialId = catalog.materials[0]?.id || "";
      renderItems(); renderCatalogFilters(); renderManualLines(); bind();
      if (internal) {
        document.getElementById("manualSlabs").value = state.manualSlabCount ?? "";
        document.getElementById("manualMaterialPrice").value = state.manualMaterialPriceUsdCents / 100;
        document.getElementById("materialMarkup").value = state.materialMarkupBps / 100;
        document.getElementById("materialExtra").value = state.additionalMaterialBynCents / 100;
        document.getElementById("managerAdjustment").value = state.managerAdjustmentBynCents / 100;
      }
      Object.entries(state.operations).forEach(([code, quantity]) => { const input = document.querySelector(`[data-operation="${CSS.escape(code)}"]`); if (input) input.value = quantity; });
      document.getElementById("slabFormat").value = state.slabFormatCode;
      document.getElementById("customFormat").classList.toggle("hidden", state.slabFormatCode !== "custom");
      scheduleCalculate();
    } catch (error) { showStatus(error.message, true); }
  }

  init();
})();
