(function () {
  "use strict";

  const root = document.getElementById("calculatorApp");
  if (!root) return;

  const internal = document.documentElement.dataset.calculatorMode === "internal";
  const orderId = internal ? new URLSearchParams(location.search).get("orderId") : null;
  const apiOrigin = ["5500", "5501"].includes(location.port)
    ? `${location.protocol}//${location.hostname}:3000`
    : location.origin;
  const allowedCategories = new Set(["quartz", "granite", "onyx"]);
  const shapeNames = { straight: "Прямая", l: "Г-образная", u: "П-образная" };
  const productNames = {
    countertop: "Столешница",
    windowsill: "Подоконник",
    table: "Стол",
    island: "Остров",
    bar: "Барная стойка",
  };
  const shapeImages = {
    straight: "/assets/images/calculator/shape-straight-v2.png",
    l: "/assets/images/calculator/shape-l-v2.png",
    u: "/assets/images/calculator/shape-u-v3.png",
  };
  const windowsillShapeNames = { straight: "Прямой", l: "Угловой", u: "Эркерный" };
  const windowsillShapeImages = {
    straight: "/assets/images/calculator/windowsill-shapes-v1.png",
    l: "/assets/images/calculator/windowsill-shapes-v1.png",
    u: "/assets/images/calculator/windowsill-shapes-v1.png",
  };
  const tableShapeNames = { rectangle: "Прямоугольный", round: "Круглый", oval: "Овальный" };
  const tableShapeImage = "/assets/images/calculator/table-shapes-v1.png";
  const extraImages = {
    island: "/assets/images/calculator/extra-island-v1.png",
    bar: "/assets/images/calculator/extra-bar-v1.png",
  };
  const edgeProfiles = [
    { code: "model_1", name: "Мод. 1", description: "Прямая", image: "/assets/images/calculator/edge-profile-model-1-v1.png" },
    { code: "model_2", name: "Мод. 2", description: "Скругление сверху", image: "/assets/images/calculator/edge-profile-model-2-v1.png" },
    { code: "model_3", name: "Мод. 3", description: "Полное скругление", image: "/assets/images/calculator/edge-profile-model-3-v1.png" },
    { code: "model_4", name: "Мод. 4", description: "Фаска", image: "/assets/images/calculator/edge-profile-model-4-v1.png" },
    { code: "model_5", name: "Мод. 5", description: "Фигурная, два паза", image: "/assets/images/calculator/edge-profile-model-5-v1.png" },
    { code: "model_6", name: "Мод. 6", description: "Фигурная, один паз", image: "/assets/images/calculator/edge-profile-model-6-v1.png" },
    { code: "model_7", name: "Мод. 7", description: "С водоотбойником", image: "/assets/images/calculator/edge-profile-model-7-v1.png" },
  ];
  const edgeProfileByCode = Object.fromEntries(edgeProfiles.map((profile) => [profile.code, profile]));
  const edgeRateByProfile = {
    model_1: "edge_standard",
    model_2: "edge_round",
    model_3: "edge_round",
    model_4: "edge_standard",
    model_5: "edge_standard",
    model_6: "edge_standard",
    model_7: "edge_standard",
  };
  // edge_reinforced requires a future finishedThickness field and is not profile-driven.
  const backsplashNames = {
    none: "Без бортика",
    straight: "Прямой бортик",
    coved: "Радиусный бортик",
  };
  const automaticCodes = new Set([
    "cut_straight", "joint_short", "joint_long", "edge_standard", "edge_round",
    "edge_reinforced", "backsplash_make", "backsplash", "wall_panel", "cut_curved",
    "cutout_hob", "cutout_sink_top", "cutout_sink_under", "stone_sink", "hole_faucet",
    "hole_socket", "hole_dispenser", "hole_standard", "cutout_round", "install_countertop",
    "install_sill", "install_sink", "install_plinth", "install_wall_panel", "polish_20", "polish_40",
  ]);
  const money = (cents) => `${(Number(cents || 0) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
  const number = (value, digits = 3) => Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: digits });
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const unitName = (unit) => unit === "m" ? "м" : unit === "sqm" ? "м²" : unit === "pcs" ? "шт." : unit || "услуга";
  const shapePieces = (shape, productType = "countertop") => {
    if (productType === "windowsill") {
      if (shape === "u") return [{ lengthMm: 850, widthMm: 300 }, { lengthMm: 1600, widthMm: 300 }, { lengthMm: 850, widthMm: 300 }];
      if (shape === "l") return [{ lengthMm: 1600, widthMm: 300 }, { lengthMm: 900, widthMm: 300 }];
      return [{ lengthMm: 1800, widthMm: 300 }];
    }
    if (productType === "table") return [{ lengthMm: 1600, widthMm: 900 }];
    if (shape === "u") return [{ lengthMm: 1600, widthMm: 600 }, { lengthMm: 2200, widthMm: 600 }, { lengthMm: 1600, widthMm: 600 }];
    if (shape === "l") return [{ lengthMm: 2400, widthMm: 600 }, { lengthMm: 1600, widthMm: 600 }];
    return [{ lengthMm: 2900, widthMm: 600 }];
  };

  const baseOptions = () => ({
    automaticGeometry: true,
    polishedSides: 1,
    roundedCorners: 0,
    cornerRadiusMm: 50,
    edgeCode: "edge_standard",
    edgeProfileModel: "model_1",
    installation: true,
    backsplash: false,
    backsplashType: "none",
    backsplashLengthM: 0,
    wallPanel: false,
    wallPanelAutoLength: true,
    wallPanelLengthM: 0,
    wallPanelHeightMm: 600,
    edgeSides: { front: true, left: false, right: false },
    wallSides: { back: true, left: false, right: false },
    sinkType: "under",
    hob: true,
    tapHole: true,
    socketHoles: 0,
    dispenserHoles: 0,
    roundCutouts: 0,
    otherHoles: 0,
    measurementRequested: false,
    deliveryRequested: false,
    liftingRequested: false,
    operations: [],
  });
  const defaultItem = () => ({
    ...baseOptions(),
    productType: "countertop",
    shape: "straight",
    tableShape: "rectangle",
    pieces: shapePieces("straight", "countertop"),
  });
  const defaultMainItem = (productType = "countertop") => ({
    ...baseOptions(),
    productType,
    shape: "straight",
    tableShape: "rectangle",
    pieces: shapePieces("straight", productType),
    polishedSides: productType === "table" ? 4 : 1,
    sinkType: productType === "countertop" ? "under" : "none",
    hob: productType === "countertop",
    tapHole: productType === "countertop",
    installation: productType !== "table",
  });
  const defaultExtra = (productType) => ({
    ...baseOptions(),
    productType,
    shape: "straight",
    tableShape: "rectangle",
    pieces: [{
      lengthMm: productType === "island" ? 1800 : 1600,
      widthMm: productType === "island" ? 900 : 500,
    }],
    polishedSides: 4,
    sinkType: "none",
    hob: false,
    tapHole: false,
    installation: false,
  });
  const normalizeItem = (item = {}) => {
    const productType = item.productType || "countertop";
    const edgeProfileModel = edgeProfileByCode[item.edgeProfileModel] ? item.edgeProfileModel : "model_1";
    const usesProfileRate = productType === "countertop" || productType === "windowsill";
    return {
      ...(productType === "island" || productType === "bar" ? defaultExtra(productType) : defaultMainItem(productType)),
      ...item,
      automaticGeometry: item.automaticGeometry !== false,
      polishedSides: item.productType === "island" || item.productType === "bar" || item.productType === "table" ? 4 : 1,
      roundedCorners: Number(item.roundedCorners || 0),
      cornerRadiusMm: Number(item.cornerRadiusMm || 50),
      edgeCode: usesProfileRate ? edgeRateByProfile[edgeProfileModel] : item.edgeCode || "edge_standard",
      edgeProfileModel,
      backsplashType: item.backsplashType || (item.backsplash ? "straight" : "none"),
      wallPanelAutoLength: item.wallPanelAutoLength !== false,
      wallPanelHeightMm: Number(item.wallPanelHeightMm || 600),
      edgeSides: { front: true, left: false, right: false, ...(item.edgeSides || {}) },
      wallSides: { back: true, left: false, right: false, ...(item.wallSides || {}) },
      pieces: Array.isArray(item.pieces) && item.pieces.length ? item.pieces : shapePieces(item.shape || "straight", item.productType || "countertop"),
      operations: Array.isArray(item.operations) ? item.operations : [],
    };
  };

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
    comparisonMaterialIds: [],
    comparisonResults: [],
    orderVersion: null,
    timer: null,
    summaryObserver: null,
    bound: false,
  };

  const sectionHeading = (numberLabel, title, hint) => `<div class="calc-section__heading"><span class="calc-section__number">${numberLabel}</span><div><h2>${title}</h2>${hint ? `<p class="calc-section__hint">${hint}</p>` : ""}</div></div>`;

  async function request(path, options = {}) {
    const token = localStorage.getItem("crm_token");
    const response = await fetch(`${apiOrigin}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(internal && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Ошибка ${response.status}`);
    return data;
  }

  function publicFinalMarkup() {
    return `<section class="calc-final" id="step-result" aria-labelledby="result-title">
      <div class="calc-final__heading"><div><p class="summary-kicker">05 · Итог</p><h2 id="result-title">Ваш подробный расчёт</h2><p>Расход материала округляется вверх с шагом 0,5 слэба.</p></div><div id="resultPrice" class="calc-final__price">—</div></div>
      <div id="detailedResult" class="result-placeholder">Выберите размеры и камень — здесь появится подробная смета.</div>
      <div class="result-actions" aria-label="Действия с расчётом"><button class="btn btn--gold" id="pdfAction" type="button" disabled>Сохранить PDF</button><button class="btn btn--outline" id="printAction" type="button" disabled>Распечатать</button><a class="btn btn--outline" href="/pages/contacts.html">Перейти в контакты</a></div>
      <section class="contact-card" id="step-contact" aria-labelledby="contact-title"><div class="contact-card__intro"><p class="summary-kicker">06 · Заявка</p><h2 id="contact-title">Получить точную стоимость</h2><p>Оставьте контакты. Менеджер проверит наличие камня и согласует замер.</p><div class="contact-card__direct"><a href="tel:+375293961558">+375 29 396-15-58</a><a href="mailto:prokamen22@yandex.by">prokamen22@yandex.by</a></div></div><form id="leadForm" class="lead-card" novalidate><div class="calc-row"><label class="calc-field">Имя *<input id="leadName" required minlength="2" autocomplete="name" placeholder="Как к вам обращаться" /></label><label class="calc-field">Телефон *<input id="leadPhone" required minlength="5" autocomplete="tel" inputmode="tel" placeholder="+375 __ ___-__-__" /></label><label class="calc-field calc-field--wide">Email<input id="leadEmail" type="email" autocomplete="email" placeholder="name@example.com" /></label><label class="calc-field calc-field--wide">Комментарий<textarea id="leadComment" rows="3" placeholder="Что важно учесть в проекте"></textarea></label><label class="calc-field calc-field--wide attachment-field">Эскиз или фото проекта<input id="leadAttachment" type="file" accept=".pdf,.dwg,.png,.jpg,.jpeg,.webp" /><small>PDF, DWG, PNG, JPG или WEBP, до 15 МБ</small></label></div><button class="btn btn--gold lead-submit" id="primaryAction" type="button" disabled>Отправить расчёт</button><p class="privacy-note">Нажимая кнопку, вы соглашаетесь на обработку данных для связи по заявке.</p><div id="leadStatus" class="status" aria-live="polite"></div></form></section>
    </section>`;
  }

  function renderShell() {
    const managerSection = internal ? `<div class="calc-section">${sectionHeading("04", "Корректировки менеджера", "Внутренние параметры коммерческого предложения.")}<div class="calc-row"><label class="calc-field">Расход слэбов вручную (шаг 0,5)<input id="manualSlabs" type="number" min="0" step="0.5" placeholder="Авто" /></label><label class="calc-field">Цена своего материала, USD<input id="manualMaterialPrice" type="number" min="0" step="0.01" value="0" /></label><label class="calc-field">Наценка материала, %<input id="materialMarkup" type="number" min="0" step="0.1" value="0" /></label><label class="calc-field">Доп. стоимость материала, BYN<input id="materialExtra" type="number" min="0" step="0.01" value="0" /></label><label class="calc-field">Скидка / надбавка, BYN<input id="managerAdjustment" type="number" step="0.01" value="0" /></label></div><div id="manualLines"></div><button class="btn btn--ghost" id="addManualLine" type="button">+ Дополнительная услуга</button></div>` : "";
    root.innerHTML = `<section class="calc-panel"><div class="calc-section" id="step-product">${sectionHeading("01", "Изделие и размеры", "Выберите форму и укажите размеры каждого участка.")}<div id="items"></div><button class="btn btn--ghost" id="addItem" type="button">+ Добавить ещё изделие</button><div class="extras-section"><div class="item-head"><div><strong>Дополнить проект</strong><small>Остров и барная стойка рассчитываются как отдельные изделия</small></div><span class="auto-badge">автоматический раскрой</span></div><div id="extraChoices" class="extra-choice-grid"></div><div id="extraEditors"></div></div></div><div class="calc-section" id="step-material">${sectionHeading("02", "Камень", "Формат и толщина слэба подставятся автоматически из карточки материала.")}<div class="catalog-filters"><div class="calc-row"><label class="calc-field">Категория<select id="categoryFilter"><option value="">Все материалы</option></select></label><label class="calc-field">Производитель<select id="manufacturerFilter"><option value="">Все производители</option></select></label><label class="calc-field calc-field--wide">Серия<select id="seriesFilter"><option value="">Все серии</option></select></label></div></div><div id="materials" class="calc-materials"></div><div id="selectedMaterialMeta" class="selected-material-meta"></div><div id="materialCompare"></div>${internal ? `<div class="calc-row calc-spacer"><label class="calc-field">Формат слэба<select id="slabFormat"></select></label><label class="calc-field">Толщина<input id="thickness" type="number" min="5" max="200" value="20" /></label></div><div id="customFormat" class="calc-row calc-spacer hidden"><label class="calc-field">Длина слэба<input id="customLength" type="number" value="3050" /></label><label class="calc-field">Ширина слэба<input id="customWidth" type="number" value="1440" /></label></div>` : ""}</div><div class="calc-section" id="step-finish">${sectionHeading("03", "Кромка, бортик и скинали", "Выберите внешний вид. Длину обработки система определяет по изделию.")}<div id="finishOptions"></div></div><div class="calc-section" id="step-services">${sectionHeading("04", "Вырезы, монтаж и услуги", "Добавьте только то, что потребуется в вашем проекте.")}<div id="serviceOptions"></div>${internal ? `<details class="manager-operations"><summary>Дополнительные операции менеджера</summary><div id="operations" class="operation-grid"></div></details>` : ""}</div>${managerSection}</section><aside class="calc-summary"><div class="summary-kicker">Ваш расчёт</div><div id="summaryPrice" class="summary-price">—</div><p class="summary-caption">ориентировочная стоимость в BYN</p><div id="summaryVisual" class="summary-visual"></div><ul id="summaryLines" class="summary-lines"></ul><div class="auto-note"><strong>Система считает автоматически</strong><span id="autoNote">Раскрой, стыки, кромку и расход слэбов</span></div><div id="internalTotals" class="summary-internal hidden"></div><div id="status" class="status">Загружаем актуальные цены…</div>${internal ? `<button class="btn btn--gold" id="primaryAction" type="button" disabled>${orderId ? "Сохранить в заказе" : "Скопировать смету"}</button>` : `<button class="btn btn--gold" id="summaryToResult" type="button" disabled>Посмотреть подробный итог</button>`}<p class="summary-footnote">Цена «от». Итог подтверждается после замера и проверки раскроя.</p></aside>${internal ? "" : publicFinalMarkup()}`;
    updateSummaryVisual();
  }

  function productShapeLabel(item) {
    if (item.productType === "windowsill") return windowsillShapeNames[item.shape] || "Прямой";
    if (item.productType === "table") return tableShapeNames[item.tableShape] || "Прямоугольный";
    return shapeNames[item.shape] || "Прямая";
  }

  function shapeChoices(item) {
    if (item.productType === "table") {
      return Object.entries(tableShapeNames).map(([value, label], index) => `
        <button type="button" class="shape-card table-shape-choice ${item.tableShape === value ? "is-selected" : ""}" data-value="${value}" aria-label="${label} стол">
          <span class="shape-photo shape-photo--table" style="background-position:${index === 0 ? "left" : index === 1 ? "center" : "right"} center"></span>
          <span><strong>${label}</strong></span>
        </button>`).join("");
    }
    const labels = item.productType === "windowsill" ? windowsillShapeNames : shapeNames;
    return Object.entries(labels).map(([value, label], index) => {
      const joints = value === "straight"
        ? "без угловых стыков"
        : value === "l"
          ? "1 угловой стык"
          : "2 угловых стыка";
      const visual = item.productType === "windowsill"
        ? `<span class="shape-photo shape-photo--windowsill" style="background-position:${index === 0 ? "left" : index === 1 ? "center" : "right"} center"></span>`
        : `<img src="${shapeImages[value]}" alt="${label} столешница" />`;
      return `<button type="button" class="shape-card item-shape-choice ${item.shape === value ? "is-selected" : ""}" data-value="${value}">${visual}<span><strong>${label}</strong><small>${joints}</small></span></button>`;
    }).join("");
  }

  function itemDimensions(item) {
    const isRoundTable = item.productType === "table" && item.tableShape === "round";
    if (isRoundTable) {
      return `<div class="piece-row piece-row--diameter"><span class="piece-number">Ø</span><label class="calc-field">Диаметр<input class="piece-length table-diameter" data-piece="0" type="number" min="300" max="5000" inputmode="numeric" value="${item.pieces[0].lengthMm}" /><small>мм</small></label></div>`;
    }
    return item.pieces.map((piece, pieceIndex) => `<div class="piece-row"><span class="piece-number">${pieceIndex + 1}</span><label class="calc-field">Длина<input class="piece-length" data-piece="${pieceIndex}" type="number" min="1" max="20000" inputmode="numeric" value="${piece.lengthMm}" /><small>мм</small></label><span class="dimension-sign">×</span><label class="calc-field">${item.productType === "table" ? "Ширина" : "Глубина"}<input class="piece-width" data-piece="${pieceIndex}" type="number" min="1" max="5000" inputmode="numeric" value="${piece.widthMm}" /><small>мм</small></label></div>`).join("");
  }

  function renderItems() {
    const mainTypes = new Set(["countertop", "windowsill", "table"]);
    const mainItems = state.items.map((item, index) => ({ item, index })).filter(({ item }) => mainTypes.has(item.productType));
    document.getElementById("items").innerHTML = mainItems.map(({ item, index }, visibleIndex) => `<article class="item-card item-card--${item.productType}" data-item="${index}">
      <div class="item-head"><strong>${mainItems.length > 1 ? `Основное изделие ${visibleIndex + 1}` : "Что рассчитываем?"}</strong>${mainItems.length > 1 ? `<button type="button" class="btn--danger remove-item">Удалить</button>` : ""}</div>
      <div class="choice-grid choice-grid--product">
        <button type="button" class="choice-card choice-card--product item-product-choice ${item.productType === "countertop" ? "is-selected" : ""}" data-value="countertop"><span class="product-symbol">▰</span><span>Столешница<small>Кухня или ванная</small></span></button>
        <button type="button" class="choice-card choice-card--product item-product-choice ${item.productType === "windowsill" ? "is-selected" : ""}" data-value="windowsill"><span class="product-symbol">▱</span><span>Подоконник<small>Прямой, угловой, эркерный</small></span></button>
        <button type="button" class="choice-card choice-card--product item-product-choice ${item.productType === "table" ? "is-selected" : ""}" data-value="table"><span class="product-symbol">●</span><span>Стол<small>Прямоугольный, круглый, овальный</small></span></button>
      </div>
      <div class="item-head"><strong>${item.productType === "table" ? "Форма столешницы стола" : "Форма изделия"}</strong><span class="auto-badge">стыки — автоматически</span></div>
      <div class="choice-grid choice-grid--shape">${shapeChoices(item)}</div>
      <div class="dimension-box"><p class="dimension-box__title">${item.pieces.length > 1 ? "Размеры каждого участка" : "Размер изделия"}</p>${itemDimensions(item)}</div>
    </article>`).join("");
    renderExtras();
    renderOptions();
    updateSummaryVisual();
  }

  function renderExtras() {
    const choices = document.getElementById("extraChoices");
    const editors = document.getElementById("extraEditors");
    if (!choices || !editors) return;
    const hasCountertop = state.items.some((item) => item.productType === "countertop");
    choices.closest(".extras-section")?.classList.toggle("hidden", !hasCountertop);
    if (!hasCountertop) return;
    choices.innerHTML = ["island", "bar"].map((type) => { const selected = state.items.some((item) => item.productType === type); return `<button type="button" class="extra-choice ${selected ? "is-selected" : ""}" data-extra-toggle="${type}"><img src="${extraImages[type]}" alt="${productNames[type]} из камня" /><span class="extra-choice__body"><span class="smart-toggle__check">${selected ? "✓" : "+"}</span><span><strong>${productNames[type]}</strong><small>${type === "island" ? "Отдельная рабочая зона" : "Стойка с полукруглым краем"}</small></span></span></button>`; }).join("");
    editors.innerHTML = state.items.map((item, index) => ({ item, index })).filter(({ item }) => item.productType === "island" || item.productType === "bar").map(({ item, index }) => { const piece = item.pieces[0]; const isIsland = item.productType === "island"; return `<article class="extra-editor" data-extra-item="${index}"><div class="extra-editor__visual"><img src="${extraImages[item.productType]}" alt="${productNames[item.productType]}" /></div><div class="extra-editor__content"><div class="item-head"><div><strong>${productNames[item.productType]}</strong><small>${isIsland ? "Кромка считается по полному периметру" : "Полукруглый край учитывается автоматически"}</small></div><button type="button" class="btn--danger remove-extra">Убрать</button></div><div class="piece-row piece-row--extra"><span class="piece-number">1</span><label class="calc-field">Длина<input class="extra-length" type="number" min="300" max="10000" value="${piece.lengthMm}" /><small>мм</small></label><span class="dimension-sign">×</span><label class="calc-field">Глубина<input class="extra-width" type="number" min="250" max="3000" value="${piece.widthMm}" /><small>мм</small></label></div>${isIsland ? `<div class="radius-config"><div><span class="radius-label">Закруглённые углы</span><div class="pill-group">${[[0, "Без закругления"], [2, "2 угла"], [4, "4 угла"]].map(([count, label]) => `<button type="button" class="pill-choice ${item.roundedCorners === count ? "is-selected" : ""}" data-extra-corners="${count}">${label}</button>`).join("")}</div></div>${item.roundedCorners ? `<div><span class="radius-label">Закругление</span><div class="pill-group">${[20, 50, 100].map((radius) => `<button type="button" class="pill-choice ${item.cornerRadiusMm === radius ? "is-selected" : ""}" data-extra-radius="${radius}">R${radius}</button>`).join("")}</div></div>` : ""}</div>` : ""}</div></article>`; }).join("");
  }

  function toggleCard(label, field, checked, hint, unpriced = false) {
    return `<button type="button" class="smart-toggle ${checked ? "is-selected" : ""}" data-field="${field}"><span class="smart-toggle__check">${checked ? "✓" : "+"}</span><span><strong>${label}</strong>${hint ? `<small>${hint}</small>` : ""}${unpriced ? `<em>Стоимость уточнит менеджер</em>` : ""}</span></button>`;
  }
  function quantityField(label, field, value, hint) {
    return `<label class="quantity-option"><span><strong>${label}</strong><small>${hint}</small></span><span class="quantity-option__control"><button type="button" data-counter="${field}" data-delta="-1" aria-label="Уменьшить">−</button><input class="service-quantity" data-field="${field}" type="number" min="0" max="20" step="1" value="${value}" aria-label="${label}" /><button type="button" data-counter="${field}" data-delta="1" aria-label="Увеличить">+</button></span></label>`;
  }

  function sideButton(item, group, side, label) {
    const selected = Boolean(item[group]?.[side]);
    return `<button type="button" class="side-choice__button ${selected ? "is-selected" : ""}" data-side-group="${group}" data-side="${side}" aria-pressed="${selected}"><b>${selected ? "✓" : "+"}</b><span>${label}</span></button>`;
  }

  function sideSettings(item) {
    return `<details class="side-settings"><summary>Уточнить обрабатываемые стороны</summary><div class="side-settings__group"><strong>Кромка</strong><p>По умолчанию обрабатывается только лицевая сторона.</p><div class="side-choice">${sideButton(item, "edgeSides", "front", "Лицевая")}${sideButton(item, "edgeSides", "left", "Левый торец")}${sideButton(item, "edgeSides", "right", "Правый торец")}</div></div>${item.productType === "countertop" ? `<div class="side-settings__group"><strong>Стороны у стены</strong><p>Используются для автоматической длины бортика и скинали.</p><div class="side-choice">${sideButton(item, "wallSides", "back", "Тыльная")}${sideButton(item, "wallSides", "left", "Левая")}${sideButton(item, "wallSides", "right", "Правая")}</div></div>` : ""}</details>`;
  }

  function renderOptions() {
    if (!state.catalog) return;
    const mainTypes = new Set(["countertop", "windowsill", "table"]);
    const mainItems = state.items.map((item, index) => ({ item, index })).filter(({ item }) => mainTypes.has(item.productType));
    document.getElementById("finishOptions").innerHTML = mainItems.map(({ item, index }, visibleIndex) => {
      const title = mainItems.length > 1 ? `<h3>${productNames[item.productType]} ${visibleIndex + 1}</h3>` : "";
      const edgeBlock = `<div class="option-block option-block--visual"><div class="option-title"><strong>${item.productType === "table" ? "Вид кромки по периметру" : "Вид передней кромки"}</strong><span>Выберите профиль — обрабатываемая длина рассчитывается автоматически</span></div><div class="edge-choice-grid">${edgeProfiles.map((profile) => `<button type="button" class="edge-choice edge-choice--photo ${item.edgeProfileModel === profile.code ? "is-selected" : ""}" data-edge-profile="${profile.code}" aria-pressed="${item.edgeProfileModel === profile.code}"><img class="edge-photo" src="${profile.image}" alt="Кромка ${escape(profile.name)} — ${escape(profile.description)}" loading="lazy" /><span class="edge-choice__copy"><strong>${escape(profile.name)}</strong><small>${escape(profile.description)}</small></span></button>`).join("")}</div></div>`;
      if (item.productType !== "countertop") return `<div class="smart-options" data-option-item="${index}">${title}${edgeBlock}${item.productType === "windowsill" ? sideSettings(item) : ""}</div>`;
      const backsplashBlock = `<div class="option-block option-block--visual"><div class="option-title"><strong>Тип бортика</strong><span>Располагается у стены</span></div><div class="backsplash-grid">${["none", "straight", "coved"].map((type, position) => `<button type="button" class="backsplash-choice ${item.backsplashType === type ? "is-selected" : ""}" data-backsplash="${type}"><span class="backsplash-photo" style="background-position:${position === 0 ? "left" : position === 1 ? "center" : "right"} center"></span><span><strong>${backsplashNames[type]}</strong><small>${type === "none" ? "Без бортика" : type === "straight" ? "По длине у стены" : "Фигурный вариант — по согласованию"}</small></span></button>`).join("")}</div>${item.backsplashType !== "none" ? `<div class="length-setting"><label class="calc-field">Длина бортика, м<input class="backsplash-length" type="number" min="0" max="1000" step="0.1" value="${item.backsplashLengthM || ""}" placeholder="Автоматически" /></label><p>${item.backsplashType === "coved" ? "Радиусный вариант сохраняется в заявке; стоимость подтвердит менеджер." : "Оставьте пустым, чтобы взять длину стороны у стены."}</p></div>` : ""}</div>`;
      const skinaliBlock = `<div class="option-block"><div class="option-title"><strong>Скинали</strong><span>Каменная панель на стене</span></div><div class="skinali-control">${toggleCard("Добавить скинали", "wallPanel", item.wallPanel, "Из выбранного камня")}${item.wallPanel ? `<div class="skinali-length-mode">${toggleCard("По тыльному периметру", "wallPanelAutoLength", item.wallPanelAutoLength, "По отмеченным сторонам у стены")}${item.wallPanelAutoLength ? `<p class="auto-length-note">Длина рассчитывается по выбранным тыльным сторонам изделия.</p>` : `<label class="calc-field">Длина скинали, м<input class="wall-panel-length" type="number" min="0.1" max="1000" step="0.1" value="${item.wallPanelLengthM || ""}" placeholder="Укажите длину" /></label>`}<label class="calc-field">Высота скинали<input class="wall-panel-height" type="number" min="50" max="5000" step="10" value="${item.wallPanelHeightMm || 600}" /><small>мм</small></label></div>` : ""}</div></div>`;
      return `<div class="smart-options" data-option-item="${index}">${title}${edgeBlock}${sideSettings(item)}${backsplashBlock}${skinaliBlock}</div>`;
    }).join("");
    document.getElementById("serviceOptions").innerHTML = mainItems.map(({ item, index }, visibleIndex) => {
      const title = mainItems.length > 1 ? `<h3>${productNames[item.productType]} ${visibleIndex + 1}</h3>` : "";
      const requestBlock = `<div class="option-block additional-services"><div class="option-title"><strong>Услуги по запросу</strong><span>Менеджер уточнит условия</span></div><div class="smart-toggle-grid">${toggleCard("Вызов замерщика", "measurementRequested", item.measurementRequested, "Согласуем дату и адрес", true)}${toggleCard("Доставка", "deliveryRequested", item.deliveryRequested, "Зависит от адреса", true)}${toggleCard("Подъём", "liftingRequested", item.liftingRequested, "Зависит от этажа и условий", true)}</div></div>`;
      if (item.productType === "table") return `<div class="smart-options" data-option-item="${index}">${title}${requestBlock}</div>`;
      if (item.productType === "windowsill") return `<div class="smart-options" data-option-item="${index}">${title}<div class="smart-toggle-grid">${toggleCard("Монтаж подоконника", "installation", item.installation, "Установка по длине изделия")}</div>${requestBlock}</div>`;
      return `<div class="smart-options" data-option-item="${index}">${title}<div class="option-block"><div class="option-title"><strong>Мойка</strong><span>Выберите способ установки</span></div><div class="sink-choice">${[["none", "Без мойки"], ["top", "Накладная"], ["under", "Подстольная"], ["stone", "Из камня"]].map(([value, label]) => `<button type="button" class="pill-choice ${item.sinkType === value ? "is-selected" : ""}" data-sink="${value}">${label}</button>`).join("")}</div></div><div class="smart-toggle-grid">${toggleCard("Варочная панель", "hob", item.hob, "Вырез под технику")}${toggleCard("Отверстие под смеситель", "tapHole", item.tapHole, "Одно стандартное отверстие")}${toggleCard("Монтаж", "installation", item.installation, "Установка столешницы")}</div><div class="quantity-grid">${quantityField("Розетки", "socketHoles", item.socketHoles, "Отверстия в камне")}${quantityField("Дозатор", "dispenserHoles", item.dispenserHoles, "Отверстия под дозатор")}${quantityField("Круглые вырезы", "roundCutouts", item.roundCutouts, "Овальная или круглая форма")}${quantityField("Другие отверстия", "otherHoles", item.otherHoles, "Прочие стандартные отверстия")}</div>${requestBlock}</div>`;
    }).join("");
  }

  function renderCatalogFilters() {
    const { categories, materials, formats } = state.catalog;
    document.getElementById("categoryFilter").innerHTML = `<option value="">Все материалы</option>${categories.filter((item) => allowedCategories.has(item.id)).map((item) => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("")}`;
    const unique = (key) => [...new Set(materials.filter((item) => allowedCategories.has(item.category)).map((item) => item[key]).filter(Boolean))].sort();
    document.getElementById("manufacturerFilter").innerHTML = `<option value="">Все производители</option>${unique("manufacturer").map((value) => `<option>${escape(value)}</option>`).join("")}`;
    document.getElementById("seriesFilter").innerHTML = `<option value="">Все серии</option>${unique("series").map((value) => `<option>${escape(value)}</option>`).join("")}`;
    if (internal) {
      document.getElementById("slabFormat").innerHTML = formats.map((format) => `<option value="${escape(format.code)}">${escape(format.name)}${format.custom ? " — свои размеры" : ` — ${format.lengthMm}×${format.widthMm}×${format.thicknessMm}`}</option>`).join("");
      document.getElementById("operations").innerHTML = state.catalog.operations.filter((operation) => !automaticCodes.has(operation.code)).map((operation) => `<label class="operation"><span>${escape(operation.name)}<small>${unitName(operation.unit)}</small></span><input aria-label="Количество: ${escape(operation.name)}" type="number" min="0" step="${operation.unit === "m" || operation.unit === "sqm" ? "0.1" : "1"}" value="${state.operations[operation.code] || 0}" data-operation="${escape(operation.code)}" /></label>`).join("");
    }
    renderMaterials(); renderOptions();
  }

  function materialAndFormat() {
    const material = state.catalog?.materials.find((item) => item.id === state.materialId);
    const format = state.catalog?.formats.find((item) => Number(item.id) === Number(material?.slabFormatId)) || state.catalog?.formats.find((item) => item.code === state.slabFormatCode);
    return { material, format };
  }
  function syncMaterialFormat() {
    const { material, format } = materialAndFormat();
    if (!material || !format || internal) return;
    state.slabFormatCode = format.code;
    state.customFormat = { lengthMm: format.lengthMm, widthMm: format.widthMm, thicknessMm: material.thicknessMm || format.thicknessMm };
  }
  function renderSelectedMaterialMeta() {
    const host = document.getElementById("selectedMaterialMeta");
    if (!host) return;
    const { material, format } = materialAndFormat();
    host.innerHTML = material && format ? `<span>Выбранный камень</span><strong>${escape(material.title)}</strong><div><span>${escape(material.manufacturer || "ПРО Камень")}</span><span>${escape(format.name)} · ${format.lengthMm} × ${format.widthMm}</span><span>Толщина ${material.thicknessMm || format.thicknessMm}</span></div>` : "";
  }
  function renderMaterials() {
    const category = document.getElementById("categoryFilter").value;
    const manufacturer = document.getElementById("manufacturerFilter").value;
    const series = document.getElementById("seriesFilter").value;
    const list = state.catalog.materials.filter((item) => allowedCategories.has(item.category) && (!category || item.category === category) && (!manufacturer || item.manufacturer === manufacturer) && (!series || item.series === series));
    document.getElementById("materials").innerHTML = list.length ? list.map((item) => { const compared = state.comparisonMaterialIds.includes(item.id); return `<article class="material-card ${state.materialId === item.id ? "is-selected" : ""}">${item.image ? `<img src="${escape(new URL(item.image, apiOrigin).href)}" alt="Образец ${escape(item.title)}" loading="lazy" />` : `<span class="material-card__placeholder" aria-hidden="true"></span>`}<button class="material-card__select" type="button" data-material="${escape(item.id)}" aria-pressed="${state.materialId === item.id}"><span class="material-card__body"><strong>${escape(item.title)}</strong><small>${escape([item.manufacturer, item.series].filter(Boolean).join(" · ") || "ПРО Камень")}</small></span></button>${internal ? "" : `<button class="material-card__compare ${compared ? "is-selected" : ""}" type="button" data-compare-material="${escape(item.id)}" aria-pressed="${compared}">${compared ? "✓ В сравнении" : "+ Сравнить"}</button>`}</article>`; }).join("") : `<p class="material-empty">Материалы по выбранному фильтру не найдены.</p>`;
    renderSelectedMaterialMeta();
    renderMaterialComparison();
  }

  function renderMaterialComparison() {
    const host = document.getElementById("materialCompare");
    if (!host || internal) return;
    if (!state.comparisonMaterialIds.length) {
      host.innerHTML = `<p class="compare-hint">Можно отметить до трёх камней и сравнить итоговую стоимость.</p>`;
      return;
    }
    const cards = state.comparisonMaterialIds.map((id) => {
      const material = state.catalog.materials.find((entry) => entry.id === id);
      const result = state.comparisonResults.find((entry) => entry.materialId === id)?.calculation;
      return `<article class="compare-card"><strong>${escape(material?.title || id)}</strong>${result ? `<dl><div><dt>Материал</dt><dd>${money(result.totals.materialBynCents)}</dd></div><div><dt>Работы</dt><dd>${money(result.totals.worksBynCents)}</dd></div><div><dt>Итого от</dt><dd>${money(result.publicFromTotalCents)}</dd></div></dl>` : `<small>Рассчитываем…</small>`}<button type="button" data-material="${escape(id)}">Выбрать</button></article>`;
    }).join("");
    host.innerHTML = `<section class="material-comparison"><div class="option-title"><strong>Сравнение вариантов</strong><span>Без раскрытия стоимости отдельных операций</span></div><div class="compare-grid">${cards}</div></section>`;
  }
  function renderManualLines() {
    const host = document.getElementById("manualLines"); if (!host) return;
    host.innerHTML = state.additionalLines.map((line, index) => `<div class="manual-line" data-line="${index}"><div class="item-head"><strong>Дополнительная строка ${index + 1}</strong><button type="button" class="btn--danger remove-line">Удалить</button></div><div class="calc-row"><label class="calc-field">Название<input class="line-name" value="${escape(line.name)}" /></label><label class="calc-field">Количество<input class="line-quantity" type="number" min="0" step="0.1" value="${line.quantity}" /></label><label class="calc-field">Единица<input class="line-unit" value="${escape(line.unit)}" /></label><label class="calc-field">Цена за единицу, BYN<input class="line-price" type="number" min="0" step="0.01" value="${line.unitPriceCents / 100}" /></label></div><label class="calc-field calc-spacer">Комментарий<input class="line-comment" value="${escape(line.comment || "")}" /></label></div>`).join("");
  }

  function updateSummaryVisual() {
    const host = document.getElementById("summaryVisual"); if (!host) return;
    const item = state.items.find((entry) => ["countertop", "windowsill", "table"].includes(entry.productType)) || state.items[0] || defaultItem();
    const geometryIndex = state.items.indexOf(item);
    const splitCount = Number(state.calculation?.metrics?.items?.[geometryIndex]?.lengthSplitCount || 0);
    const angularJoints = item.shape === "u" ? 2 : item.shape === "l" ? 1 : 0;
    const seamCount = item.productType === "table" ? splitCount : angularJoints + splitCount;
    const seams = seamCount ? `<span class="summary-seams" aria-label="Стыков: ${seamCount}">${Array.from({ length: seamCount }, (_, index) => `<i style="left:${(index + 1) * 100 / (seamCount + 1)}%"></i>`).join("")}</span>` : "";
    if (item.productType === "windowsill") {
      const position = item.shape === "straight" ? "left" : item.shape === "l" ? "center" : "right";
      host.innerHTML = `<span class="summary-product-sprite summary-product-sprite--windowsill" style="background-position:${position} center" role="img" aria-label="Подоконник — ${productShapeLabel(item)}"></span>${seams}`;
      return;
    }
    if (item.productType === "table") {
      const position = item.tableShape === "rectangle" ? "left" : item.tableShape === "round" ? "center" : "right";
      host.innerHTML = `<span class="summary-product-sprite summary-product-sprite--table" style="background-position:${position} center" role="img" aria-label="Стол — ${productShapeLabel(item)}"></span>${seams}`;
      return;
    }
    const source = item.productType === "island" || item.productType === "bar" ? extraImages[item.productType] : shapeImages[item.shape];
    host.innerHTML = `<img src="${source}" alt="${productNames[item.productType]} — ${productShapeLabel(item)}" />${seams}`;
  }
  function configuration() {
    const items = state.items.map(({ processedEdgeM, straightCutM, ...source }) => {
      const item = { ...source, backsplash: source.backsplashType !== "none", operations: [] };
      if (item.productType === "windowsill" || item.productType === "table") {
        Object.assign(item, { backsplash: false, backsplashType: "none", backsplashLengthM: 0, wallPanel: false, wallPanelLengthM: 0, sinkType: "none", hob: false, tapHole: false, socketHoles: 0, dispenserHoles: 0, roundCutouts: 0, otherHoles: 0 });
      }
      if (item.productType === "table") Object.assign(item, { shape: "straight", polishedSides: 4, installation: false });
      return item;
    });
    return { items, operations: Object.entries(state.operations).filter(([, value]) => Number(value) > 0).map(([code, value]) => ({ code, quantity: Number(value) })), additionalLines: internal ? state.additionalLines : [], manualSlabCount: internal ? state.manualSlabCount : null, manualMaterialPriceUsdCents: internal ? state.manualMaterialPriceUsdCents : 0, materialMarkupBps: internal ? state.materialMarkupBps : 0, additionalMaterialBynCents: internal ? state.additionalMaterialBynCents : 0, managerAdjustmentBynCents: internal ? state.managerAdjustmentBynCents : 0 };
  }
  function payload() { return { materialId: state.materialId, slabFormatCode: state.slabFormatCode, ...(state.slabFormatCode === "custom" ? { customFormat: state.customFormat } : {}), configuration: configuration() }; }
  function payloadForMaterial(materialId) {
    const material = state.catalog.materials.find((item) => item.id === materialId);
    const format = state.catalog.formats.find((item) => Number(item.id) === Number(material?.slabFormatId));
    return {
      materialId,
      slabFormatCode: format?.code || state.slabFormatCode,
      ...(format?.code === "custom" ? { customFormat: { lengthMm: format.lengthMm, widthMm: format.widthMm, thicknessMm: material?.thicknessMm || format.thicknessMm } } : {}),
      configuration: configuration(),
    };
  }
  function scheduleCalculate() { clearTimeout(state.timer); state.timer = setTimeout(calculate, 180); }
  async function calculate() {
    if (!state.materialId) return showStatus("Выберите материал.");
    showStatus("Рассчитываем…");
    try {
      const result = await request(internal ? "/api/calculator/preview" : "/api/public/calculator/preview", { method: "POST", body: JSON.stringify(payload()) });
      state.calculation = result.calculation; renderSummary(); showStatus("Расчёт актуален.");
      if (!internal && state.comparisonMaterialIds.length) {
        state.comparisonResults = await Promise.all(state.comparisonMaterialIds.map(async (materialId) => {
          if (materialId === state.materialId) return { materialId, calculation: state.calculation };
          try {
            const response = await request("/api/public/calculator/preview", { method: "POST", body: JSON.stringify(payloadForMaterial(materialId)) });
            return { materialId, calculation: response.calculation };
          } catch (error) {
            return { materialId, error: error.message };
          }
        }));
        renderMaterialComparison();
      }
      document.getElementById("primaryAction").disabled = false;
      document.getElementById("summaryToResult")?.removeAttribute("disabled"); document.getElementById("pdfAction")?.removeAttribute("disabled"); document.getElementById("printAction")?.removeAttribute("disabled");
    } catch (error) { state.calculation = null; document.getElementById("primaryAction").disabled = true; showStatus(error.message, true); }
  }

  function requestedServices(item) { return [item.measurementRequested ? "Вызов замерщика" : "", item.deliveryRequested ? "Доставка" : "", item.liftingRequested ? "Подъём" : "", item.backsplashType === "coved" ? "Радиусный бортик" : ""].filter(Boolean); }
  function slabLayoutMarkup(calculation) {
    const layout = calculation.metrics?.slabLayout;
    if (!layout?.slabs?.length) return "";
    const slabs = layout.slabs.slice(0, 4).map((slab) => {
      const parts = slab.parts.map((part) => {
        const x = part.xMm / layout.slabLengthMm * 100;
        const y = part.yMm / layout.slabWidthMm * 100;
        const width = part.lengthMm / layout.slabLengthMm * 100;
        const height = part.widthMm / layout.slabWidthMm * 100;
        return `<span class="slab-part ${part.wallPanel ? "is-wall-panel" : ""}" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%" title="${part.wallPanel ? "Скинали" : `Деталь ${part.itemIndex + 1}.${part.pieceIndex + 1}`}">${part.continuation ? `<i aria-label="Линия стыка"></i>` : ""}</span>`;
      }).join("");
      return `<div class="slab-layout__item"><strong>Слэб ${slab.index + 1}</strong><div class="slab-canvas" style="aspect-ratio:${layout.slabLengthMm}/${layout.slabWidthMm}">${parts}</div></div>`;
    }).join("");
    return `<div class="slab-layout"><div class="option-title"><strong>Предварительная раскладка</strong><span>Пунктиром отмечены автоматические продолжения и стыки</span></div><div class="slab-layout__grid">${slabs}</div><p>Учтён технологический зазор ${layout.kerfMm} мм. Финальную раскладку подтверждает технолог.</p></div>`;
  }
  function renderDetailedResult() {
    const host = document.getElementById("detailedResult"); if (!host || !state.calculation) return;
    const calculation = state.calculation; const slab = calculation.material.slabFormat || {}; const selectedMaterial = state.catalog.materials.find((item) => item.id === state.materialId);
    const itemCards = state.items.map((item, index) => {
      const dimensions = item.productType === "table" && item.tableShape === "round"
        ? `Ø ${item.pieces[0].lengthMm}`
        : item.pieces.map((piece) => `${piece.lengthMm} × ${piece.widthMm}`).join("; ");
      const services = requestedServices(item);
      const isMainKitchen = item.productType === "countertop";
      const selectedEdge = edgeProfileByCode[item.edgeProfileModel] || edgeProfiles[0];
      const facts = `<div><dt>Кромка</dt><dd>${escape(`${selectedEdge.name} · ${selectedEdge.description}`)}</dd></div>${isMainKitchen ? `<div><dt>Бортик</dt><dd>${backsplashNames[item.backsplashType] || "Без бортика"}</dd></div>` : ""}${item.productType !== "table" ? `<div><dt>Монтаж</dt><dd>${item.installation ? "Включён" : "Не выбран"}</dd></div>` : ""}${services.length ? `<div><dt>По запросу</dt><dd>${services.join(", ")}</dd></div>` : ""}`;
      return `<article class="result-product"><div><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${productNames[item.productType] || "Изделие"}</strong><small>${productShapeLabel(item)} · ${dimensions} мм</small></div></div><dl>${facts}</dl></article>`;
    }).join("");
    const unpriced = [...new Set(state.items.flatMap(requestedServices))];
    host.innerHTML = `<div class="result-products">${itemCards}</div><div class="result-columns"><section class="result-card"><h3>Материал и расход</h3><dl class="result-facts"><div><dt>Камень</dt><dd>${escape([selectedMaterial?.manufacturer, calculation.material.title].filter(Boolean).join(" · "))}</dd></div><div><dt>Формат слэба</dt><dd>${escape(slab.name || slab.code || "—")} · ${slab.lengthMm || "—"} × ${slab.widthMm || "—"}</dd></div><div><dt>Толщина</dt><dd>${slab.thicknessMm || selectedMaterial?.thicknessMm || "—"}</dd></div><div><dt>Площадь изделий${calculation.metrics.wallPanelAreaM2 ? " и скинали" : ""}</dt><dd>${number(calculation.metrics.areaM2)} м²</dd></div><div><dt>С технологическим запасом</dt><dd>${number(calculation.metrics.areaWithWasteM2)} м²</dd></div><div class="result-facts__accent"><dt>Расход материала</dt><dd>${number(calculation.material.slabCount, 1)} слэба</dd></div></dl><p class="result-formula">${number(calculation.metrics.areaWithWasteM2)} м² ÷ ${number(calculation.metrics.slabAreaM2)} м² = ${number(calculation.metrics.areaWithWasteM2 / calculation.metrics.slabAreaM2)} → <strong>${number(calculation.material.slabCount, 1)} слэба</strong><br />Округление вверх до ближайших 0,5.</p>${slabLayoutMarkup(calculation)}</section><section class="result-card result-card--cost"><h3>Стоимость</h3><p class="cost-intro">Показываем итог понятно, без внутренних ставок и цены каждой операции.</p><table class="result-table"><tbody><tr><td><strong>Материал</strong><small>${number(calculation.material.slabCount, 1)} слэба</small></td><td>${money(calculation.totals.materialBynCents)}</td></tr><tr><td><strong>Все работы</strong><small>Раскрой, обработка, стыки и выбранные опции</small></td><td>${money(calculation.totals.worksBynCents)}</td></tr></tbody><tfoot><tr class="result-total"><td>Итого от</td><td>${money(calculation.publicFromTotalCents)}</td></tr></tfoot></table>${unpriced.length ? `<div class="unpriced-note"><strong>По запросу, без включения в сумму:</strong> ${unpriced.join(", ")}.</div>` : ""}</section></div><p class="result-disclaimer">Расчёт является ориентировочным. Точная стоимость определяется после замера и подтверждения наличия выбранного камня.</p>`;
    document.getElementById("resultPrice").textContent = `от ${money(calculation.publicFromTotalCents)}`;
  }
  function renderSummary() {
    const calculation = state.calculation; if (!calculation) return;
    const totalCents = internal ? calculation.totals.finalQuoteTotalCents : calculation.publicFromTotalCents; const firstItem = state.items.find((item) => ["countertop", "windowsill", "table"].includes(item.productType)) || state.items[0] || defaultItem(); const selectedMaterial = state.catalog.materials.find((item) => item.id === state.materialId);
    document.getElementById("summaryPrice").textContent = `${internal ? "" : "от "}${money(totalCents)}`;
    document.getElementById("summaryLines").innerHTML = internal ? [`<li><span>Материал (${calculation.material.slabCount} слэба)</span><strong>${money(calculation.totals.materialBynCents)}</strong></li>`, ...calculation.lines.filter((line) => Number(line.amountBynCents) > 0).map((line) => `<li><span>${escape(line.name)} × ${number(line.quantity)}</span><strong>${money(line.amountBynCents)}</strong></li>`)].join("") : `<li><span>Материал</span><strong>${money(calculation.totals.materialBynCents)}</strong></li><li><span>Все работы</span><strong>${money(calculation.totals.worksBynCents)}</strong></li>`;
    document.getElementById("autoNote").textContent = `Раскрой, ${calculation.metrics.jointCount ? `${calculation.metrics.jointCount} стык(а)` : "без стыков"}, кромка ${number(calculation.metrics.processedEdgeM)} м и расход с шагом 0,5`;
    updateSummaryVisual();
    if (internal) { const box = document.getElementById("internalTotals"); box.classList.remove("hidden"); box.innerHTML = `Техническая сумма: <strong>${money(calculation.totals.technicalTotalCents)}</strong><br>Резерв: <strong>${money(calculation.totals.reserveCents)}</strong><br>Рекомендуемая цена: <strong>${money(calculation.totals.recommendedManagerTotalCents)}</strong><br>Версия прайса: <strong>${calculation.pricebookVersion}</strong>`; } else renderDetailedResult();
  }
  function showStatus(message, isError = false) { const node = document.getElementById("status"); if (!node) return; node.textContent = message || ""; node.classList.toggle("error", isError); node.classList.toggle("success", !isError && Boolean(message)); }
  function showLeadStatus(message, isError = false) { const node = document.getElementById("leadStatus"); if (!node) return; node.textContent = message || ""; node.classList.toggle("error", isError); node.classList.toggle("success", !isError && Boolean(message)); }

  function setupSummaryVisibility() {
    if (internal || !("IntersectionObserver" in window)) return;
    state.summaryObserver?.disconnect();
    const summary = root.querySelector(".calc-summary");
    const result = document.getElementById("step-result");
    if (!summary || !result) return;
    state.summaryObserver = new IntersectionObserver(([entry]) => {
      summary.classList.toggle("is-hidden-at-end", entry.isIntersecting);
    }, { threshold: 0.02 });
    state.summaryObserver.observe(result);
  }

  async function primaryAction() {
    if (!state.calculation) return; const button = document.getElementById("primaryAction"); if (!internal && !document.getElementById("leadForm").reportValidity()) return; button.disabled = true;
    try {
      if (!internal) { const contact = { name: document.getElementById("leadName").value.trim(), phone: document.getElementById("leadPhone").value.trim(), email: document.getElementById("leadEmail").value.trim(), comment: document.getElementById("leadComment").value.trim() }; const result = await request("/api/public/calculator/leads", { method: "POST", body: JSON.stringify({ ...payload(), contact }) }); const file = document.getElementById("leadAttachment")?.files?.[0]; if (file) { const form = new FormData(); form.append("token", result.attachmentToken); form.append("file", file); const upload = await fetch(`${apiOrigin}/api/public/calculator/leads/${encodeURIComponent(result.leadId)}/attachment`, { method: "POST", body: form, credentials: "include" }); const uploadResult = await upload.json().catch(() => ({})); if (!upload.ok) throw new Error(`Заявка отправлена, но файл не загружен: ${uploadResult.message || "ошибка загрузки"}`); } showLeadStatus(`Заявка №${result.leadId} отправлена${file ? " вместе с файлом" : ""}. Менеджер свяжется с вами.`); }
      else if (orderId) { const result = await request(`/api/orders/${encodeURIComponent(orderId)}/calculator`, { method: "PUT", body: JSON.stringify({ version: state.orderVersion, total_amount: state.calculation.totals.finalQuoteTotalCents / 100, exchange_rate: state.calculation.exchangeRate, calculator_snapshot: state.calculation }) }); state.orderVersion = result.version; showStatus("Расчёт сохранён в заказе."); }
      else { await navigator.clipboard.writeText(document.querySelector(".calc-summary").innerText); showStatus("Смета скопирована."); }
    } catch (error) { if (internal) showStatus(error.message, true); else showLeadStatus(error.message, true); } finally { button.disabled = false; }
  }
  async function downloadPdf() {
    if (!state.calculation) return; const button = document.getElementById("pdfAction"); button.disabled = true; const oldText = button.textContent; button.textContent = "Формируем PDF…";
    try { const response = await fetch(`${apiOrigin}/api/public/calculator/pdf`, { method: "POST", credentials: "include", headers: { Accept: "application/pdf", "Content-Type": "application/json" }, body: JSON.stringify(payload()) }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Не удалось сформировать PDF"); } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "PRO-Kamen-raschet.pdf"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); showLeadStatus("PDF сохранён."); } catch (error) { showLeadStatus(error.message, true); } finally { button.disabled = false; button.textContent = oldText; }
  }

  function bind() {
    if (state.bound) return; state.bound = true;
    root.addEventListener("click", (event) => {
      if (event.target.closest("#addItem")) { state.items.push(defaultItem()); renderItems(); scheduleCalculate(); return; }
      if (event.target.closest("#primaryAction")) { primaryAction(); return; }
      if (event.target.closest("#summaryToResult")) { document.getElementById("step-result")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (event.target.closest("#pdfAction")) { downloadPdf(); return; }
      if (event.target.closest("#printAction")) { window.print(); return; }
      if (event.target.closest("#addManualLine")) { state.additionalLines.push({ name: "Дополнительная услуга", quantity: 1, unit: "услуга", unitPriceCents: 0, currency: "BYN", category: "additional", comment: "" }); renderManualLines(); return; }
      const compareMaterial = event.target.closest("[data-compare-material]"); if (compareMaterial) { const id = compareMaterial.dataset.compareMaterial; if (state.comparisonMaterialIds.includes(id)) state.comparisonMaterialIds = state.comparisonMaterialIds.filter((entry) => entry !== id); else if (state.comparisonMaterialIds.length < 3) state.comparisonMaterialIds.push(id); else { showStatus("Для сравнения можно выбрать не больше трёх камней.", true); return; } state.comparisonResults = []; renderMaterials(); scheduleCalculate(); return; }
      const materialCard = event.target.closest("[data-material]"); if (materialCard) { state.materialId = materialCard.dataset.material; syncMaterialFormat(); renderMaterials(); scheduleCalculate(); return; }
      const itemCard = event.target.closest("[data-item]"); if (itemCard) { const index = Number(itemCard.dataset.item); const item = state.items[index]; if (event.target.closest(".remove-item")) state.items.splice(index, 1); else if (event.target.closest(".item-product-choice")) { const nextType = event.target.closest(".item-product-choice").dataset.value; if (item.productType !== nextType) { state.items[index] = defaultMainItem(nextType); if (nextType !== "countertop" && !state.items.some((entry) => entry.productType === "countertop")) state.items = state.items.filter((entry) => entry.productType !== "island" && entry.productType !== "bar"); } } else if (event.target.closest(".item-shape-choice")) { item.shape = event.target.closest(".item-shape-choice").dataset.value; item.pieces = shapePieces(item.shape, item.productType); } else if (event.target.closest(".table-shape-choice")) { item.tableShape = event.target.closest(".table-shape-choice").dataset.value; item.pieces = item.tableShape === "round" ? [{ lengthMm: 1100, widthMm: 1100 }] : [{ lengthMm: 1600, widthMm: 900 }]; } else return; renderItems(); scheduleCalculate(); return; }
      const extraToggle = event.target.closest("[data-extra-toggle]"); if (extraToggle) { const index = state.items.findIndex((item) => item.productType === extraToggle.dataset.extraToggle); if (index >= 0) state.items.splice(index, 1); else state.items.push(defaultExtra(extraToggle.dataset.extraToggle)); renderItems(); scheduleCalculate(); return; }
      const extraCard = event.target.closest("[data-extra-item]"); if (extraCard) { const index = Number(extraCard.dataset.extraItem); const item = state.items[index]; if (event.target.closest(".remove-extra")) state.items.splice(index, 1); else if (event.target.closest("[data-extra-corners]")) item.roundedCorners = Number(event.target.closest("[data-extra-corners]").dataset.extraCorners); else if (event.target.closest("[data-extra-radius]")) item.cornerRadiusMm = Number(event.target.closest("[data-extra-radius]").dataset.extraRadius); else return; renderItems(); scheduleCalculate(); return; }
      const optionGroup = event.target.closest("[data-option-item]"); if (optionGroup) { const item = state.items[Number(optionGroup.dataset.optionItem)]; const edgeProfile = event.target.closest("[data-edge-profile]"); const backsplash = event.target.closest("[data-backsplash]"); const sink = event.target.closest("[data-sink]"); const toggle = event.target.closest("[data-field]"); const counter = event.target.closest("[data-counter]"); const side = event.target.closest("[data-side-group]"); if (edgeProfile) { item.edgeProfileModel = edgeProfile.dataset.edgeProfile; item.edgeCode = item.productType === "countertop" || item.productType === "windowsill" ? edgeRateByProfile[item.edgeProfileModel] : "edge_standard"; } else if (backsplash) { item.backsplashType = backsplash.dataset.backsplash; item.backsplash = item.backsplashType !== "none"; } else if (sink) item.sinkType = sink.dataset.sink; else if (side) { const group = side.dataset.sideGroup; item[group] = { ...(item[group] || {}), [side.dataset.side]: !item[group]?.[side] }; } else if (counter) item[counter.dataset.counter] = Math.max(0, Math.min(20, Number(item[counter.dataset.counter] || 0) + Number(counter.dataset.delta))); else if (toggle && toggle.tagName === "BUTTON") { const field = toggle.dataset.field; item[field] = !item[field]; if (field === "wallPanelAutoLength" && !item[field] && !item.wallPanelLengthM) item.wallPanelLengthM = Math.round(item.pieces.reduce((sum, piece) => sum + Number(piece.lengthMm || 0), 0)) / 1000; } else return; renderOptions(); scheduleCalculate(); return; }
      const lineCard = event.target.closest("[data-line]"); if (lineCard && event.target.closest(".remove-line")) { state.additionalLines.splice(Number(lineCard.dataset.line), 1); renderManualLines(); scheduleCalculate(); }
    });
    root.addEventListener("input", (event) => {
      const itemCard = event.target.closest("[data-item]"); if (itemCard) { const item = state.items[Number(itemCard.dataset.item)]; if (event.target.matches(".piece-length")) { item.pieces[Number(event.target.dataset.piece)].lengthMm = Number(event.target.value); if (event.target.matches(".table-diameter")) item.pieces[0].widthMm = Number(event.target.value); } if (event.target.matches(".piece-width")) item.pieces[Number(event.target.dataset.piece)].widthMm = Number(event.target.value); scheduleCalculate(); return; }
      const extraCard = event.target.closest("[data-extra-item]"); if (extraCard) { const item = state.items[Number(extraCard.dataset.extraItem)]; if (event.target.matches(".extra-length")) item.pieces[0].lengthMm = Number(event.target.value); if (event.target.matches(".extra-width")) item.pieces[0].widthMm = Number(event.target.value); scheduleCalculate(); return; }
      const optionGroup = event.target.closest("[data-option-item]"); if (optionGroup) { const item = state.items[Number(optionGroup.dataset.optionItem)]; if (event.target.matches(".backsplash-length")) item.backsplashLengthM = Number(event.target.value || 0); if (event.target.matches(".wall-panel-length")) item.wallPanelLengthM = Number(event.target.value || 0); if (event.target.matches(".wall-panel-height")) item.wallPanelHeightMm = Number(event.target.value || 600); if (event.target.matches(".service-quantity")) item[event.target.dataset.field] = Number(event.target.value || 0); scheduleCalculate(); return; }
      if (event.target.dataset.operation) { state.operations[event.target.dataset.operation] = Number(event.target.value); scheduleCalculate(); return; }
      const lineCard = event.target.closest("[data-line]"); if (lineCard) { const line = state.additionalLines[Number(lineCard.dataset.line)]; if (event.target.matches(".line-name")) line.name = event.target.value; if (event.target.matches(".line-quantity")) line.quantity = Number(event.target.value); if (event.target.matches(".line-unit")) line.unit = event.target.value; if (event.target.matches(".line-price")) line.unitPriceCents = Math.round(Number(event.target.value) * 100); if (event.target.matches(".line-comment")) line.comment = event.target.value; scheduleCalculate(); return; }
      if (!internal) return; if (event.target.id === "manualSlabs") state.manualSlabCount = event.target.value === "" ? null : Number(event.target.value); if (event.target.id === "manualMaterialPrice") state.manualMaterialPriceUsdCents = Math.round(Number(event.target.value) * 100); if (event.target.id === "materialMarkup") state.materialMarkupBps = Math.round(Number(event.target.value) * 100); if (event.target.id === "materialExtra") state.additionalMaterialBynCents = Math.round(Number(event.target.value) * 100); if (event.target.id === "managerAdjustment") state.managerAdjustmentBynCents = Math.round(Number(event.target.value) * 100); if (["customLength", "customWidth", "thickness"].includes(event.target.id)) { state.customFormat.lengthMm = Number(document.getElementById("customLength").value); state.customFormat.widthMm = Number(document.getElementById("customWidth").value); state.customFormat.thicknessMm = Number(document.getElementById("thickness").value); } scheduleCalculate();
    });
    root.addEventListener("change", (event) => { if (["categoryFilter", "manufacturerFilter", "seriesFilter"].includes(event.target.id)) { renderMaterials(); return; } if (event.target.id === "slabFormat") { state.slabFormatCode = event.target.value; document.getElementById("customFormat").classList.toggle("hidden", state.slabFormatCode !== "custom"); scheduleCalculate(); } });
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 2) return;
    state.items = (snapshot.configuration?.items || state.items).map(normalizeItem); state.operations = Object.fromEntries((snapshot.configuration?.operations || []).map((item) => [item.code, item.quantity])); state.additionalLines = snapshot.configuration?.additionalLines || []; state.manualSlabCount = snapshot.configuration?.manualSlabCount ?? null; state.manualMaterialPriceUsdCents = snapshot.configuration?.manualMaterialPriceUsdCents || 0; state.materialMarkupBps = snapshot.configuration?.materialMarkupBps || 0; state.additionalMaterialBynCents = snapshot.configuration?.additionalMaterialBynCents || 0; state.managerAdjustmentBynCents = snapshot.configuration?.managerAdjustmentBynCents || 0; state.materialId = snapshot.material?.id || ""; state.slabFormatCode = snapshot.material?.slabFormat?.code || "normal";
  }
  async function init() {
    renderShell(); bind(); setupSummaryVisibility();
    try {
      const [catalog, orderResponse] = await Promise.all([request(internal ? "/api/calculator/catalog" : "/api/public/calculator/catalog"), orderId ? request(`/api/orders/${encodeURIComponent(orderId)}`) : Promise.resolve(null)]); state.catalog = catalog;
      if (orderResponse?.order) { state.orderVersion = orderResponse.order.version; restoreSnapshot(orderResponse.order.calculator_snapshot); document.getElementById("calculatorBack").href = `order.html?id=${encodeURIComponent(orderId)}`; }
      if (!state.materialId) state.materialId = catalog.materials.find((item) => allowedCategories.has(item.category))?.id || ""; syncMaterialFormat(); renderItems(); renderCatalogFilters(); renderManualLines();
      if (internal) { document.getElementById("manualSlabs").value = state.manualSlabCount ?? ""; document.getElementById("manualMaterialPrice").value = state.manualMaterialPriceUsdCents / 100; document.getElementById("materialMarkup").value = state.materialMarkupBps / 100; document.getElementById("materialExtra").value = state.additionalMaterialBynCents / 100; document.getElementById("managerAdjustment").value = state.managerAdjustmentBynCents / 100; document.getElementById("slabFormat").value = state.slabFormatCode; document.getElementById("customFormat").classList.toggle("hidden", state.slabFormatCode !== "custom"); }
      scheduleCalculate();
    } catch (error) { root.innerHTML = `<section class="setup-error"><span class="setup-error__icon" aria-hidden="true">!</span><h2>Калькулятор временно настраивается</h2><p>${escape(error.message || "Не удалось загрузить актуальные материалы и цены.")}</p><button type="button" class="btn btn--ghost" id="retryCalculator">Попробовать снова</button></section>`; document.getElementById("retryCalculator")?.addEventListener("click", init, { once: true }); }
  }
  init();
})();
