// =========================================================
// 1. КОНСТАНТЫ И СПРАВОЧНИКИ
// =========================================================
const statusLabels = {
  lead: { text: "Новая заявка", bg: "bg-blue-100 text-blue-800" },
  new: { text: "Новая заявка", bg: "bg-blue-100 text-blue-800" },
  measurement: { text: "Замер", bg: "bg-indigo-100 text-indigo-800" },
  quote_approval: { text: "КП и ТЗ", bg: "bg-purple-100 text-purple-800" },
  waiting_payment: {
    text: "Ожидание оплаты",
    bg: "bg-orange-100 text-orange-800",
  },
  waiting_stone: {
    text: "Ожидание камня",
    bg: "bg-yellow-100 text-yellow-800",
  },
  in_production: {
    text: "В производстве",
    bg: "bg-yellow-200 text-yellow-900",
  },
  ready_shipping: {
    text: "Готово к отгрузке",
    bg: "bg-emerald-100 text-emerald-800",
  },
  logistics_install: {
    text: "Логистика/Монтаж",
    bg: "bg-cyan-100 text-cyan-800",
  },
  final_calculation: {
    text: "Финальный расчет",
    bg: "bg-green-100 text-green-800",
  },
  archived: { text: "Успешно закрыт", bg: "bg-gray-200 text-gray-800" },
  cancelled: { text: "Отменен", bg: "bg-red-100 text-red-800" },
};
const stageOrder = [
  "new",
  "measurement",
  "quote_approval",
  "waiting_payment",
  "waiting_stone",
  "in_production",
  "ready_shipping",
  "logistics_install",
  "final_calculation",
];
const statusFlow = {
  // lead — стартовый статус (его ставит бэкенд при создании заказа)
  lead: { next: "measurement", nextText: "Отправить на замер", prev: null },
  new: { next: "measurement", nextText: "Отправить на замер", prev: null },
  measurement: {
    next: "quote_approval",
    nextText: "Смета готова",
    prev: "new",
    prevText: "В новые",
  },
  quote_approval: {
    next: "waiting_payment",
    nextText: "На оплату",
    prev: "measurement",
    prevText: "Переделать смету",
  },
  waiting_payment: {
    next: "waiting_stone",
    nextText: "Оплачено. Ждем камень",
    prev: "quote_approval",
    prevText: "Отмена",
  },
  waiting_stone: {
    next: "in_production",
    nextText: "В цех!",
    prev: "waiting_payment",
    prevText: "Отказ по камню",
  },
  in_production: {
    next: "ready_shipping",
    nextText: "Изготовлено",
    prev: "waiting_stone",
    prevText: "Брак. Вернуть",
  },
  ready_shipping: {
    next: "logistics_install",
    nextText: "В логистику",
    prev: "in_production",
    prevText: "Вернуть в цех",
  },
  logistics_install: {
    next: "final_calculation",
    nextText: "Установлено. К расчету",
    prev: "ready_shipping",
    prevText: "Срыв монтажа",
  },
  final_calculation: {
    next: "archived",
    nextText: "Закрыть сделку",
    prev: "logistics_install",
    prevText: "Рекламация",
  },
  archived: {
    next: null,
    nextText: "",
    prev: "final_calculation",
    prevText: "Вернуть в работу",
  },
  cancelled: {
    next: null,
    nextText: "",
    prev: null,
    prevText: "",
  },
};
const deadlineOffsets = {
  new: 0,
  measurement: 2,
  quote_approval: 4,
  waiting_payment: 6,
  waiting_stone: 11,
  in_production: 15,
  ready_shipping: 17,
  logistics_install: 19,
  final_calculation: 21,
};

// Текущий заказ, открытый в карточке (обновляется кнопками переходов статусов)
let currentOrderView = null;

// Смена статуса из карточки заказа.
// ВАЖНО: страница order.html НЕ подключает kanban.js, поэтому здесь своя
// реализация через api.updateOrderStatus + перерисовка карточки.
async function changeOrderStatus(orderId, newStatus) {
  if (!orderId || orderId === "НОВЫЙ") {
    alert("Сначала сохраните заказ.");
    return false;
  }
  try {
    await api.updateOrderStatus(
      orderId,
      newStatus,
      null,
      currentOrderView?.version,
    );
    const res = await api.getOrder(orderId);
    const fresh = res.order || res;
    if (currentOrderView) Object.assign(currentOrderView, fresh);
    renderOrderData(currentOrderView || fresh, false);
    return true;
  } catch (e) {
    console.error("Ошибка смены статуса:", e);
    alert("❌ " + e.message);
    return false;
  }
}



function readMoney(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  // Запятые ввода ("596,00") → точки для parseFloat, иначе БД выдаст ошибку.
  // Пробелы-разделители тысяч ("1 500,00") удаляются до разбора: parseFloat
  // обрывается на первом пробеле и молча искажал бы сумму.
  return parseFloat(String(el.value).replace(/\s+/g, "").replace(",", ".")) || 0;
}

// =========================================================
// 2. УМНЫЙ РАСЧЁТ ДАТ (ГРАФИК РАБОТ / ДЕДЛАЙНЫ)
// =========================================================
// Цепочка этапов, которые пересчитываются автоматически при ручном
// изменении любого из них. Каждый следующий этап = предыдущий + CHAIN_GAP.
// Этапы ВНЕ цепочки (промежуточные и ФИНАЛЬНЫЙ срок) НЕ трогаются.
const AUTO_CHAIN = [
  "measurement", // Замер
  "quote_approval", // КП и ТЗ = Замер + 1
  "waiting_payment", // Ожидание оплаты = КП и ТЗ + 1
  "waiting_stone", // Ожидание камня = Ожидание оплаты + 2
];
const CHAIN_GAP = {
  quote_approval: 1,
  waiting_payment: 1,
  waiting_stone: 2,
};
// ФИНАЛЬНЫЙ срок (например, "В производстве" / сдача) — жёсткая дата,
// НИКОГДА не пересчитывается автоматически, только вручную пользователем.
const FINAL_STAGE = "final_calculation";

// Прибавляет дни к дате "YYYY-MM-DD". setDate сам обрабатывает
// переход между месяцами и годами (30.06 + 1 = 01.07 и т.п.).
function addDays(dateStr, days) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days || 0));
  // Формируем из ЛОКАЛЬНЫХ компонентов (а не toISOString, который вернёт
  // предыдущий день для положительных UTC-смещений вроде UTC+3).
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, "0"),
    dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Нормализует дату из БД/JSON к строгому формату YYYY-MM-DD для <input type="date">.
// Если дата пришла с временем ("2026-08-11T12:00:00.000Z"), обрезаем часть со
// временем — иначе браузер проигнорирует value и инпут останется пустым.
function normalizeDateForInput(value) {
  if (!value) return "";
  const d = String(value).split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

// UX: при вводе года двумя цифрами (браузер трактует "26" как год "0026")
// автоматически преобразует год в 2000-2099 ("0026-08-11" → "2026-08-11").
function autoCorrectYear(input) {
  if (!input || !input.value) return false;
  const [y, m, d] = input.value.split("-");
  const n = parseInt(y, 10);
  if (y && m && d && n > 0 && n < 100) {
    input.value = `${2000 + n}-${m}-${d}`;
    return true;
  }
  return false;
}

// Собирает чистый объект дат со всех инпутов: { stage: 'YYYY-MM-DD', ... }
function collectDeadlines() {
  const dl = {};
  document.querySelectorAll(".deadline-input").forEach((i) => {
    // Авто-коррекция года (26 → 2026) на случай, если событие не успело
    // обработаться (авто-заполнение, черновик «НОВЫЙ» и т.п.).
    autoCorrectYear(i);
    const v = String(i.value || "").trim();
    // Собираем только непустые значения в формате YYYY-MM-DD.
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) dl[i.dataset.stage] = v;
  });
  return dl;
}

// Цепочный пересчёт: пользователь изменил этап changedStage —
// следующие этапы цепочки сдвигаются вперёд, ФИНАЛЬНЫЙ срок не трогаем.
function recomputeDeadlineChain(changedStage) {
  const startIdx = AUTO_CHAIN.indexOf(changedStage);
  if (startIdx === -1) return; // изменение вне цепочки (напр. финальный срок)
  const first = document.querySelector(
    `.deadline-input[data-stage="${changedStage}"]`,
  );
  if (!first || !first.value) return;
  let prev = first.value;
  for (let i = startIdx + 1; i < AUTO_CHAIN.length; i++) {
    const stage = AUTO_CHAIN[i];
    const inp = document.querySelector(`.deadline-input[data-stage="${stage}"]`);
    if (!inp) continue;
    prev = addDays(prev, CHAIN_GAP[stage] || 0);
    inp.value = prev;
  }
  validateLiveDeadlines();
}

function validateLiveDeadlines() {
  let h = null,
    err = false,
    ec = [
      "border-red-500",
      "bg-red-50",
      "text-red-700",
      "ring-2",
      "ring-red-500",
    ];
  stageOrder.forEach((s) => {
    const i = document.querySelector(`.deadline-input[data-stage="${s}"]`);
    if (!i || !i.value) return;
    const c = new Date(i.value);
    c.setHours(0, 0, 0, 0);
    if (isNaN(c.getTime())) {
      i.classList.add(...ec);
      err = true;
      return;
    }
    if (h && c < h) {
      i.classList.add(...ec);
      err = true;
    } else {
      i.classList.remove(...ec);
      h = c;
    }
  });
  [
    document.getElementById("createOrderBtn"),
    document.getElementById("saveDeadlinesBtn"),
  ].forEach((b) => {
    if (b) {
      b.disabled = err;
      err
        ? b.classList.add("opacity-50", "cursor-not-allowed")
        : b.classList.remove("opacity-50", "cursor-not-allowed");
    }
  });
  return !err;
}
function bindLiveDeadlineValidation() {
  stageOrder.forEach((s) => {
    const i = document.querySelector(`.deadline-input[data-stage="${s}"]`);
    if (!i) return;
    // change → авто-коррекция года (26 → 2026) + цепной пересчёт дат
    i.addEventListener("change", () => {
      autoCorrectYear(i);
      recomputeDeadlineChain(s);
    });
    // blur → контрольный проход авто-коррекции (если change не сработал)
    i.addEventListener("blur", () => {
      if (autoCorrectYear(i)) validateLiveDeadlines();
    });
    i.addEventListener("input", validateLiveDeadlines);
  });
}

// =========================================================
// ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК авто-коррекции года (26 → 2026)
// Делегирование на document: работает для ВСЕХ .deadline-input,
// включая инпуты, пересозданные renderOrderData (innerHTML).
// Браузер трактует ввод "26" в поле года как "0026-08-11" —
// здесь год автоматически переписывается в 2000-2099.
// =========================================================
document.addEventListener("change", (e) => {
  const inp = e.target;
  if (!inp || inp.tagName !== "INPUT" || inp.type !== "date") return;
  if (!inp.classList || !inp.classList.contains("deadline-input")) return;
  if (!inp.value) return;
  let [y, m, d] = inp.value.split("-");
  const n = parseInt(y, 10);
  // Год "0026" (двузначный ввод "26") → "2026"
  if (y && m && d && n > 0 && n < 100) {
    y = String(2000 + n);
    inp.value = `${y}-${m}-${d}`;
    // Если есть функция пересчёта цепочки — вызываем после коррекции
    if (typeof recomputeDeadlineChain === "function") {
      recomputeDeadlineChain(inp.dataset.stage);
    }
  }
});

function autoFillDeadlines(startDate) {
  if (!startDate) return;
  const sd = new Date(startDate + "T00:00:00");
  if (isNaN(sd.getTime())) return;
  // Цепочка от стартовой даты: Замер = старт, далее + CHAIN_GAP.
  let prev = startDate;
  AUTO_CHAIN.forEach((s, i) => {
    const inp = document.querySelector(`.deadline-input[data-stage="${s}"]`);
    if (!inp || inp.value) return;
    if (i > 0) prev = addDays(prev, CHAIN_GAP[s] || 0);
    else prev = startDate;
    inp.value = prev;
  });
  // Промежуточные этапы и ФИНАЛЬНЫЙ срок заполняем только по умолчанию
  // фиксированными смещениями от старта (их авто-пересчёт запрещён).
  stageOrder.forEach((s) => {
    if (s === "new" || AUTO_CHAIN.includes(s)) return;
    const inp = document.querySelector(`.deadline-input[data-stage="${s}"]`);
    if (!inp || inp.value) return;
    inp.value = addDays(startDate, deadlineOffsets[s]);
  });
  validateLiveDeadlines();
}

// =========================================================
// 4. ЗАГРУЗКА ФАЙЛОВ НА СЕРВЕР
// =========================================================
async function uploadFiles(orderId, files, fileType) {
  if (!files || !files.length) return;
  try {
    await api.uploadFiles(orderId, files, fileType);
    await renderAttachments(orderId);
  } catch (e) {
    console.error("Ошибка загрузки файлов:", e);
    alert("❌ Ошибка загрузки: " + e.message);
  }
}
// =========================================================
// 5. ОТОБРАЖЕНИЕ ПРИКРЕПЛЁННЫХ ФАЙЛОВ (БЕЗОПАСНЫЙ РЕНДЕРИНГ)
// =========================================================
async function renderAttachments(orderId) {
  try {
    const d = await api.getAttachments(orderId);
    const files = d.files || [];
    const dc = document.getElementById("documentsContainer");
    const pc = document.getElementById("photosContainer");

    const createSafeFileLink = (type, icon, emptyText, container) => {
      if (!container) return;
      container.innerHTML = "";
      const filtered = files.filter((file) => file.file_type === type);

      if (filtered.length === 0) {
        const p = document.createElement("p");
        p.className = "text-xs text-gray-400";
        p.textContent = emptyText;
        container.appendChild(p);
        return;
      }

      filtered.forEach((file) => {
        const div = document.createElement("div");
        div.className =
          "flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded text-sm mb-1";

        const a = document.createElement("a");
        a.href = api.resolveUrl(file.url);
        a.className = "font-medium text-blue-600 hover:text-blue-800";
        a.textContent = icon + " " + (file.file_name || "Файл");
        a.addEventListener("click", async (event) => {
          event.preventDefault();
          try {
            const blob = await api.downloadAttachment(
              orderId,
              file.attachment_id,
            );
            const blobUrl = window.URL.createObjectURL(blob);
            const download = document.createElement("a");
            download.href = blobUrl;
            download.download = file.file_name || "attachment";
            document.body.appendChild(download);
            download.click();
            download.remove();
            window.URL.revokeObjectURL(blobUrl);
          } catch (error) {
            alert("❌ " + error.message);
          }
        });

        const span = document.createElement("span");
        span.className = "text-xs text-gray-400";
        span.textContent = file.created_at
          ? new Date(file.created_at).toLocaleDateString("ru-RU")
          : "";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className =
          "ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg font-black text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50";
        deleteButton.textContent = "×";
        deleteButton.title = `Удалить файл «${file.file_name || "Файл"}»`;
        deleteButton.setAttribute("aria-label", deleteButton.title);
        AttachmentUI.bindDeleteButton(deleteButton, {
          fileName: file.file_name || "Файл",
          confirmDelete: AttachmentUI.showDeleteConfirmation,
          deleteAttachment: () =>
            api.deleteAttachment(orderId, file.attachment_id),
          refresh: () => renderAttachments(orderId),
          onError: (error) =>
            alert("❌ Ошибка удаления: " + error.message),
        });

        const metadata = document.createElement("div");
        metadata.className = "ml-3 flex shrink-0 items-center";
        metadata.append(span, deleteButton);

        div.appendChild(a);
        div.appendChild(metadata);
        container.appendChild(div);
      });
    };

    createSafeFileLink("document", "📄", "Нет прикрепленных чертежей", dc);
    createSafeFileLink("photo", "🖼️", "Нет прикрепленных фото", pc);
  } catch (e) {
    console.error("Ошибка загрузки списка файлов:", e);
  }
}
// =========================================================
// 6. СКАЧИВАНИЕ PDF С СЕРВЕРА
// =========================================================
async function downloadPdf(orderId) {
  try {
    const blob = await api.downloadPdf(orderId);
    const url = window.URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "KP_" + orderId + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Ошибка скачивания PDF:", e);
    alert("❌ " + e.message);
  }
}

// =========================================================
// 7. ИНИЦИАЛИЗАЦИЯ
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  const p = new URLSearchParams(window.location.search),
    id = p.get("id"),
    cu = JSON.parse(localStorage.getItem("currentUser") || "{}");
  if (!id || id === "НОВЫЙ") {
    initNewOrderPage(cu);
    return;
  }
  try {
    const d = await api.getOrder(id);
    const o = d.order || d;
    currentOrderView = o;
    // Восстанавливаем черновик калькулятора, если он есть
    const draft = draftStorage.load(id);
    if (draft && o.calculatorData) {
      o.calculatorData = draft;
      o.calculator_snapshot = draft;
    }
    renderOrderData(o, false);
    setupOrderListeners(o, cu, false);
  } catch (e) {
    console.error("Ошибка загрузки заказа:", e);
    document.getElementById("errorMessage")?.classList.remove("hidden");
    document.getElementById("orderContent")?.classList.add("hidden");
  }
});

function initNewOrderPage(cu) {
  document.getElementById("orderIdDisplay").textContent = "НОВЫЙ";
  document.getElementById("statusBadge")?.classList.add("hidden");
  ["historyTimeline", "actionButtonsContainer", "cancelOrderBtn"].forEach(
    (id) => {
      document.getElementById(id)?.parentElement?.classList.add("hidden");
    },
  );
  document.getElementById("saveFinancesBtn")?.classList.remove("hidden");
  const today = (() => {
    // Локальная дата (без сдвига дней из-за UTC в toISOString).
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  })(),
    no = {
      id: "НОВЫЙ",
      status: "new",
      history: [],
      logs: [],
      stageDeadlines: { new: today },
      sum: 0,
      prepayment: 0,
      calculatorData: {},
    };
  currentOrderView = no;

  // Восстанавливаем черновик калькулятора из localStorage
  const draft = draftStorage.load("НОВЫЙ");
  if (draft) {
    no.calculatorData = draft;
    no.calculator_snapshot = draft;
  }

  renderOrderData(no, true);
  autoFillDeadlines(today);
  const lc = document.querySelector(".lg\\:col-span-8");
  if (lc) {
    document.getElementById("createOrderBtn")?.remove();
    const b = document.createElement("button");
    b.id = "createOrderBtn";
    b.type = "button";
    b.className =
      "w-full mt-6 bg-yellow-500 hover:bg-yellow-600 text-white font-black py-4 rounded-xl shadow-2xl transition-colors";
    b.textContent = "🚀 СОЗДАТЬ ЗАКАЗ";
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCreateOrder(cu);
    };
    lc.appendChild(b);
  }
  setupOrderListeners(no, cu, true);
}
async function handleCreateOrder(cu) {
  const ne = document.getElementById("clientName");
  if (!ne || !String(ne.value?.trim?.() ?? "")) return alert("Введите имя заказчика!");
  if (!validateLiveDeadlines()) return alert("Исправьте ошибки в датах.");
  const sb = document.getElementById("createOrderBtn"),
    ob = sb?.innerHTML || "🚀 СОЗДАТЬ ЗАКАЗ";
  if (sb) {
    sb.disabled = true;
    sb.innerHTML = "⏳ Сохранение на сервер...";
  }
  // Даты со всех инпутов (учитывая авто-сохранённые по кнопке сроков)
  const rawDeadlines =
    window.tempDeadlines && Object.keys(window.tempDeadlines).length
      ? window.tempDeadlines
      : collectDeadlines();
  const dl = Object.fromEntries(
    Object.entries(rawDeadlines)
      .map(([stage, value]) => [stage, normalizeDateForInput(value)])
      .filter(([, value]) => Boolean(value)),
  );
  const gv = (id) =>
      document.getElementById(id)?.value?.trim?.() ?? "",
    sv = readMoney("totalSumInput"),
    pp = readMoney("prepaymentInput"),
    cd = window.tempCalcData || {};
  const su = JSON.parse(localStorage.getItem("currentUser") || "{}"),
    st = JSON.parse(localStorage.getItem("crm_settings") || "{}"),
    parsedExchangeRate = Number(
      String(st.exchangeRate ?? "").replace(",", "."),
    ),
    er = Number.isFinite(parsedExchangeRate) && parsedExchangeRate > 0
      ? parsedExchangeRate
      : null,
    sp = Object.keys(cd).length > 0 ? cd : null;
  const body = {
    manager_id: Number(su?.user_id || cu?.user_id) || null,
    status_id: "lead",
    total_amount: sv,
    prepayment: pp,
    order_source: gv("orderSource") || null,
    stone_name: gv("stoneType") || null,
    product_type: gv("productType") || null,
    installation_address: gv("orderLocation") || null,
    deadline_date: dl[FINAL_STAGE] || null,
    deadlines: dl,
    client: {
      full_name: String(ne.value ?? "").trim(),
      phone: gv("clientPhone") || null,
      email: gv("clientEmail") || null,
      address: gv("orderLocation") || null,
      social_networks: gv("clientSocial") || null,
    },
    exchange_rate: er,
    calculator_snapshot: sp,
    items: [
      {
        product_type_id: 1,
        material_id:
          cd.stoneId && cd.stoneId !== "0"
            ? String(cd.stoneId).trim()
            : "custom",
        length_mm: cd.length ? Number(cd.length) : null,
        width_mm: cd.width ? Number(cd.width) : null,
        area_m2:
          cd.length && cd.width
            ? Number(
                ((Number(cd.length) * Number(cd.width)) / 1000000).toFixed(3),
              )
            : null,
        edge_profile_id: cd.isThickEdge ? 2 : 1,
        edge_length_m:
          cd.edge20 || cd.edge40 ? Number(cd.edge20 || cd.edge40) : null,
        item_cost: sv,
      },
    ],
  };
  console.log("[createOrder] полный payload:", body);
  try {
    let idempotencyKey = sessionStorage.getItem("newOrderIdempotencyKey");
    if (!idempotencyKey) {
      idempotencyKey = globalThis.crypto?.randomUUID?.() ||
        `new-order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem("newOrderIdempotencyKey", idempotencyKey);
    }
    const d = await api.createOrder(body, idempotencyKey);
    sessionStorage.removeItem("newOrderIdempotencyKey");
    // Очищаем черновик после успешного сохранения
    draftStorage.remove("НОВЫЙ");
    delete window.tempCalcData;
    delete window.tempDeadlines;
    alert("Заказ сохранен!");
    const orderId = d.order_id || d.order?.order_id;
    if (orderId) {
      window.location.href = `/crm/crm/order.html?id=${orderId}`;
    } else {
      window.location.href = "dashboard.html";
    }
  } catch (e) {
    console.error("Ошибка:", e);
    if (sb) {
      sb.disabled = false;
      sb.innerHTML = ob;
    }
    alert("❌ " + e.message);
  }
}

// =========================================================
// 8. РЕНДЕР ДАННЫХ ЗАКАЗА
// =========================================================
function parseJsonField(value) {
  if (!value && value !== 0) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

function renderOrderData(order, isNew) {
  const calcDetailsBlock = document.getElementById("calcDetailsBlockContainer");
  const deadlinesBlock = document.getElementById("deadlinesList");
  const financeBlock = document.getElementById("financeInputsBlock");
  const openCalcBtn = document.getElementById("openCalcBtn");
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");
  // Интерфейс всегда свободен для ввода (и новый заказ, и существующий):
  // никаких костылей applyLock / disabled на блоках. Пользователь вводит
  // данные в любом порядке, сохраняется всё одной кнопкой (новый заказ)
  // или отдельными кнопками (существующий).
  if (openCalcBtn) {
    openCalcBtn.disabled = false;
    openCalcBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }
  if (downloadPdfBtn) {
    // PDF нельзя скачать, пока заказ не создан (нет orderId).
    downloadPdfBtn.disabled = isNew;
    downloadPdfBtn.classList.toggle("opacity-50", isNew);
    downloadPdfBtn.classList.toggle("cursor-not-allowed", isNew);
  }

  const idDisp = document.getElementById("orderIdDisplay");
  if (idDisp && !isNew) idDisp.textContent = order.order_id || order.id;
  const badge = document.getElementById("statusBadge");
  if (badge && !isNew) {
    const sk = order.status_id || order.status || "new",
      cfg = statusLabels[sk] || { text: sk, bg: "bg-gray-100 text-gray-800" };
    badge.textContent = cfg.text;
    badge.className =
      "px-3 py-1 text-sm rounded-full font-semibold shadow-sm " + cfg.bg;
  }
  const sv = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
  };
  sv("clientName", order.client_name || order.client || "");
  sv("clientPhone", order.client_phone || order.phone || "");
  sv("clientEmail", order.client_email || order.email || "");
  sv("clientSocial", order.client_social || "");
  sv("orderLocation", order.installation_address || "");
  sv("orderSource", order.order_source || "");
  sv("productType", order.product_type || "");
  sv("stoneType", order.stone_name || "");
  if (!isNew) {
    document.getElementById("cancelOrderBtn")?.classList.remove("hidden");
    document.getElementById("saveFinancesBtn")?.classList.remove("hidden");
  }
  const si = document.getElementById("totalSumInput"),
    pi = document.getElementById("prepaymentInput"),
    bd = document.getElementById("balanceDisplay");
  if (si) si.value = order.total_amount ?? 0;
  if (pi) pi.value = order.prepayment ?? 0;
  if (bd)
    bd.textContent = (
      Number(order.total_amount || 0) - Number(order.prepayment || 0)
    ).toFixed(2);
  if (si)
    si.oninput = () => {
      const s = Number(si.value) || 0,
        p = Number(pi?.value) || 0;
      if (bd) bd.textContent = (s - p).toFixed(2);
    };
  if (pi)
    pi.oninput = () => {
      const s = Number(si?.value) || 0,
        p = Number(pi.value) || 0;
      if (bd) bd.textContent = (s - p).toFixed(2);
    };
  // Дедайны
  const list = document.getElementById("deadlinesList");
  if (list) {
    list.className =
      "relative border-l-2 border-gray-200 ml-4 mt-6 space-y-4 pb-4";
    const cs = order.status_id || order.status || "new",
      ci = stageOrder.indexOf(cs),
      sd = parseJsonField(order.deadlines) || order.stageDeadlines || {};
    if (order.deadline_date) sd.final_calculation = order.deadline_date;
    list.innerHTML = stageOrder
      .map((s, idx) => {
        // <input type="date"> принимает строго YYYY-MM-DD. БД может вернуть
        // дату с таймзоной ("2026-08-11T00:00:00.000Z") — жёстко обрезаем
        // до 10 символов, иначе браузер проигнорирует value (инпут пустой).
        const safeDate = normalizeDateForInput(sd[s]),
          v = safeDate ? safeDate.substring(0, 10) : "",
          isPast = idx < ci,
          isCurrent = idx === ci,
          isLast = idx === stageOrder.length - 1;
        let dot = "bg-gray-200 border-white",
          tc = "text-gray-500";
        if (isPast) {
          dot = "bg-emerald-500 border-white";
          tc = "text-emerald-700 font-medium";
        }
        if (isCurrent) {
          dot = "bg-yellow-500 border-white ring-4 ring-yellow-100";
          tc = "text-yellow-700 font-bold";
        }
        return (
          '<div class="relative pl-6"><div class="absolute -left-[25px] top-2 w-4 h-4 rounded-full border-2 ' +
          dot +
          ' shadow-sm"></div><div class="flex items-center justify-between p-2 rounded-lg border ' +
          (isCurrent
            ? "bg-yellow-50 border-yellow-300 shadow-sm"
            : "bg-gray-50 border-gray-200") +
          '"><div class="flex flex-col"><span class="text-sm ' +
          tc +
          '">' +
          (isPast ? "✅ " : isCurrent ? "⏳ " : "") +
          "" +
          (statusLabels[s]?.text || s) +
          "</span>" +
          (isLast
            ? '<span class="text-[10px] uppercase font-bold text-red-500 mt-0.5">Фиксированная дата</span>'
            : "") +
          '</div><input type="date" class="deadline-input text-sm border-2 border-gray-300 rounded bg-white focus:bg-white focus:border-blue-400 outline-none px-2 py-1 text-right font-medium transition-colors w-[140px]" data-stage="' +
          s +
          '" value="' +
          v +
          '"></div></div>'
        );
      })
      .join("");
    bindLiveDeadlineValidation();
  }
  // Файлы
  const fc = document.getElementById("filesContainer");
  if (fc && !isNew) {
    fc.innerHTML =
      '<div class="flex items-center justify-between mb-4 border-b pb-2"><h2 class="text-lg font-bold text-gray-800 flex items-center gap-2"><span>📂</span> Документы и Фотографии</h2></div><div class="mb-6"><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-gray-700 text-sm">📄 Чертежи и договоры</h3><button id="attachDocumentBtn" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded transition-colors">+ Добавить файл</button><input type="file" id="documentUploadInput" class="hidden" multiple></div><div id="documentsContainer" class="flex flex-col gap-2"></div></div><div><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-gray-700 text-sm">🖼️ Фотографии объекта</h3><button id="attachPhotoBtn" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded transition-colors">+ Добавить фото</button><input type="file" id="photoUploadInput" class="hidden" multiple accept="image/*"></div><div id="photosContainer" class="flex flex-col gap-2"></div></div>';
    renderAttachments(order.order_id || order.id);
  }
  // История
  const hist = document.getElementById("historyTimeline");
  const orderLogs = order.history || order.logs || [];
  if (hist && orderLogs.length)
    hist.innerHTML = orderLogs
      .slice()
      .reverse()
      .map(
        (i) =>
          '<div class="relative pl-6 border-l-2 border-yellow-500 mb-4"><div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm"></div><div class="text-[10px] text-gray-400 font-bold uppercase mb-1">' +
          escapeHtml(i.date || "") +
          " | " +
          escapeHtml(i.user || "Система") +
          '</div><div class="text-sm font-medium text-gray-800">' +
          escapeHtml(i.action || "") +
          "</div>" +
          (i.comment
            ? '<div class="text-xs italic text-gray-500 bg-gray-50 p-1 rounded mt-1 border-l-2">«' +
              escapeHtml(i.comment) +
              "»</div>"
            : "") +
          "</div>",
      )
      .join("");
  // Кнопки
  const bc = document.getElementById("actionButtonsContainer");
  if (!isNew && bc) {
    const curStatus = order.status_id || order.status || "new";
    if (curStatus === "cancelled" || curStatus === "archived") {
      bc.innerHTML =
        '<div class="p-3 bg-gray-100 text-center rounded text-gray-500 font-bold">Архив</div>';
      const cb = document.getElementById("cancelOrderBtn");
      if (cb) cb.style.display = "none";
    } else {
      const f = statusFlow[curStatus];
      if (f) {
        bc.innerHTML = "";
        if (f.next) {
          const b = document.createElement("button");
          b.className =
            "w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg shadow-lg mb-2";
          b.textContent = f.nextText;
          b.onclick = () =>
            changeOrderStatus(order.id || order.order_id, f.next);
          bc.appendChild(b);
        }
        if (f.prev) {
          const b = document.createElement("button");
          b.className =
            "w-full bg-white border border-gray-300 text-gray-600 py-2 rounded-lg text-sm mb-2 hover:bg-gray-50";
          b.textContent = f.prevText;
          b.onclick = () =>
            changeOrderStatus(order.id || order.order_id, f.prev);
          bc.appendChild(b);
        }
      }
    }
  }
}

// =========================================================
// 9. СЛУШАТЕЛИ
// =========================================================
function setupOrderListeners(order, currentUser, isNew) {
  async function sos(payload, msg) {
    try {
      console.log(`[updateOrder] ${msg} → payload:`, payload);
      await api.updateOrder(order.order_id || order.id, {
        ...payload,
        version: order.version,
      });
      // PATCH-подобный PUT может затронуть связанные таблицы (например clients
      // и order_finances), поэтому локального Object.assign недостаточно:
      // client.full_name не обновляет alias client_name и UI показывал старое.
      const refreshed = await api.getOrder(order.order_id || order.id);
      Object.assign(order, refreshed.order || refreshed);
      renderOrderData(order, false);
      alert(msg);
      return true;
    } catch (e) {
      console.error("Ошибка:", e);
      let message = e.message || "Ошибка сохранения";
      if (e.details) {
        const details = e.details;
        if (typeof details === "string") {
          message = details;
        } else if (typeof details === "object") {
          const flat = Object.entries(details)
            .flatMap(([field, errors]) =>
              (Array.isArray(errors) ? errors : [errors]).map(
                (err) => `${field}: ${err}`,
              ),
            )
            .filter(Boolean)
            .join("; ");
          if (flat) message = `${message}: ${flat}`;
        }
      }
      alert("❌ " + message);
      return false;
    }
  }
  // Калькулятор
  Array.from(document.querySelectorAll("button"))
    .filter((b) => b.textContent.includes("калькулятор"))
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const ot = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "⏳ Загрузка...";
        try {
          await openCalculatorModal(order);
        } catch (e) {
          console.error(e);
          alert("❌ " + e.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = ot;
        }
      });
    });
  // PDF (серверный)
  const dpb = document.getElementById("downloadPdfBtn");
  if (dpb) {
    dpb.addEventListener("click", async (e) => {
      e.preventDefault();
      const oid = order.order_id || order.id;
      if (!oid || oid === "НОВЫЙ") {
        alert("Сначала сохраните заказ.");
        return;
      }
      dpb.disabled = true;
      dpb.innerHTML = "⏳ Формируем PDF...";
      await downloadPdf(oid);
      dpb.disabled = false;
      dpb.innerHTML = "📄 Скачать PDF";
    });
  }
  // Финансы
  const sfb = document.getElementById("saveFinancesBtn");
  if (sfb) {
    sfb.addEventListener("click", async () => {
      const si = readMoney("totalSumInput"),
        pi = readMoney("prepaymentInput");
      if (pi > si && !confirm("Предоплата больше суммы?")) return;
      if (order.id === "НОВЫЙ") {
        alert("Черновик сохранён локально. Заказ ещё не создан на сервере.");
        return;
      }
      console.log("[finances] сумма/аванс (рубли):", { total_amount: si, prepayment: pi });
      await sos({ total_amount: si, prepayment: pi }, "Финансы сохранены");
    });
  }
  // Клиент — поля всегда разблокированы, кнопка «Редактировать» удалена из разметки.
  const scb = document.getElementById("saveClientBtn");
  if (scb) scb.classList.remove("hidden");
  if (scb) {
    scb.addEventListener("click", async () => {
      const gv = (id) =>
        document.getElementById(id)?.value?.trim?.() ?? "";
      if (order.id === "НОВЫЙ") {
        alert("Черновик сохранён локально. Заказ ещё не создан на сервере.");
        return;
      }
      await sos(
        {
          installation_address: gv("orderLocation") || null,
          order_source: gv("orderSource") || null,
          stone_name: gv("stoneType") || null,
          product_type: gv("productType") || null,
          client: {
            full_name: gv("clientName"),
            phone: gv("clientPhone"),
            email: gv("clientEmail"),
            social_networks: gv("clientSocial") || null,
          },
        },
        "Данные сохранены",
      );
    });
  }
  // Сроки — поля всегда разблокированы, кнопка «Редактировать» удалена из разметки.
  const sdb = document.getElementById("saveDeadlinesBtn");
  if (sdb) sdb.classList.remove("hidden");
  if (sdb) {
    sdb.addEventListener("click", async () => {
      if (!validateLiveDeadlines()) return alert("Исправьте красные поля.");
      const dl = collectDeadlines();
      console.log("[deadlines] собран объект:", dl);
      if (order.id === "НОВЫЙ") {
        window.tempDeadlines = dl;
        alert(
          "Сроки будут сохранены вместе с заказом при нажатии «СОЗДАТЬ ЗАКАЗ».",
        );
        return;
      }
      await sos(
        { deadlines: dl, deadline_date: dl[FINAL_STAGE] || null },
        "Сроки сохранены",
      );
    });
  }
  // Отмена
  const cb = document.getElementById("cancelOrderBtn");
  if (cb) {
    cb.addEventListener("click", async () => {
      if (!confirm("Отменить заказ?")) return;
      const reason = prompt("Причина:");
      if (reason === null) return;
      const oid = order.order_id || order.id;
      if (!oid || oid === "НОВЫЙ") {
        alert("Сначала сохраните заказ.");
        return;
      }
      try {
        await api.updateOrderStatus(
          oid,
          "cancelled",
          reason.trim() || null,
          order.version,
        );
        alert("Заказ отменен.");
        window.location.href = "dashboard.html";
      } catch (e) {
        console.error("Ошибка отмены заказа:", e);
        alert("❌ " + e.message);
      }
    });
  }
  // Загрузка файлов
  if (!isNew) {
    const db = document.getElementById("attachDocumentBtn"),
      di = document.getElementById("documentUploadInput");
    if (db && di) {
      db.onclick = () => di.click();
      di.onchange = (e) => {
        const oid = order.order_id || order.id;
        if (oid && oid !== "НОВЫЙ") {
          uploadFiles(oid, e.target.files, "document");
          di.value = "";
        }
      };
    }
    const pb = document.getElementById("attachPhotoBtn"),
      pdi = document.getElementById("photoUploadInput");
    if (pb && pdi) {
      pb.onclick = () => pdi.click();
      pdi.onchange = (e) => {
        const oid = order.order_id || order.id;
        if (oid && oid !== "НОВЫЙ") {
          uploadFiles(oid, e.target.files, "photo");
          pdi.value = "";
        }
      };
    }
  }
}

// =========================================================
// 10. КАЛЬКУЛЯТОР
// =========================================================
async function openCalculatorModal(order) {
  const orderId = order.order_id || order.id;
  if (!orderId || orderId === "НОВЫЙ") {
    alert("Сначала сохраните заказ, затем откройте технический калькулятор.");
    return;
  }
  window.location.href = `calculator.html?orderId=${encodeURIComponent(orderId)}`;
  return;

  const raw = order.calculator_snapshot || order.calculatorData,
    es = raw && raw.isInitialized ? raw : null;
  const io =
    !!es ||
    [
      "quote_approval",
      "waiting_payment",
      "in_production",
      "ready_shipping",
      "logistics_install",
      "final_calculation",
      "archived",
    ].includes(order.status_id || order.status || "");
  const defaults = {
    length: 2900,
    width: 600,
    isThickEdge: false,
    edgeFront: true,
    edgeLeft: true,
    edgeRight: true,
    plinthBack: true,
    plinthLeft: false,
    plinthRight: false,
    stoneId: "0",
    slabAmt: 0.5,
    isAutoSlab: true,
    customSlabPrice: 0,
    sinkUnder: 0,
    sinkTop: 0,
    hob: 0,
    joint: 0,
    hole: 0,
    deliveryBYN: 150,
    installBYN: 300,
  };
  const rawData = { ...defaults, ...(es || {}) };
  const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
  };
  const data = {
    ...rawData,
    length: safeNumber(rawData.length, defaults.length),
    width: safeNumber(rawData.width, defaults.width),
    slabAmt: safeNumber(rawData.slabAmt, defaults.slabAmt),
    customSlabPrice: safeNumber(rawData.customSlabPrice),
    sinkUnder: safeNumber(rawData.sinkUnder),
    sinkTop: safeNumber(rawData.sinkTop),
    joint: safeNumber(rawData.joint),
    hole: safeNumber(rawData.hole),
    deliveryBYN: safeNumber(rawData.deliveryBYN, defaults.deliveryBYN),
    installBYN: safeNumber(rawData.installBYN, defaults.installBYN),
    stoneId: String(rawData.stoneId ?? "0"),
  };
  const defP = {};
  let materials = [],
    PRICES = defP;
  try {
    const [md, sd] = await Promise.all([api.getMaterials(), api.getServices()]);
    materials = Array.isArray(md.materials) ? md.materials : [];
    // ВАЖНО: мерджим с дефолтами. Если сервер вернул сервисы с другими
    // ключами (например, русские имена из dict_services), camelCase-цены
    // из defP сохраняются — иначе PRICES.cutStraight === undefined → NaN/undefined.
    PRICES = { ...defP, ...(sd.services || sd || {}) };
  } catch (e) {
    console.error("Ошибка загрузки:", e);
    materials = [];
    PRICES = defP;
  }
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4";
  let oh = '<option value="0" data-price="0">--- Выберите камень ---</option>';
  materials.forEach((s) => {
    const sel =
      String(data.stoneId) === String(s.material_id) ? "selected" : "";
    oh +=
      '<option value="' +
      escapeHtml(s.material_id) +
      '" data-price="' +
      Number(s.price_per_m2 || 0) +
      '" ' +
      sel +
      ">" +
      escapeHtml(s.title) +
      "</option>";
  });
  oh +=
    '<option value="custom"' +
    (data.stoneId === "custom" ? " selected" : "") +
    ">✏️ Свой камень (ручной ввод)</option>";
  const modalHTML =
    '<div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">' +
    '<div class="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0"><h2 class="text-lg font-bold"><span>🧮</span> Интеллектуальный расчет</h2><div class="flex items-center gap-2">' +
    (io
      ? '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold">Исторический снимок</span>'
      : "") +
    '<button id="closeCalcBtn" class="text-gray-400 hover:text-white transition text-2xl">&times;</button></div></div>' +
    '<div class="flex-1 overflow-y-auto p-6 bg-[#F8F9FA] grid grid-cols-1 md:grid-cols-12 gap-6">' +
    '<div class="md:col-span-7 space-y-4">' +
    '<div class="bg-white p-4 rounded-xl border shadow-sm"><h3 class="font-bold text-gray-800 mb-3 text-sm border-b pb-2">Габариты изделия</h3><div class="flex gap-4"><div class="flex-1"><label class="block text-xs text-gray-500 mb-1">Длина (мм)</label><input type="number" id="calcL" value="' +
    data.length +
    '" class="w-full border rounded p-2 text-sm calc-trigger"></div><div class="flex-1"><label class="block text-xs text-gray-500 mb-1">Глубина (мм)</label><input type="number" id="calcW" value="' +
    data.width +
    '" class="w-full border rounded p-2 text-sm calc-trigger"></div></div></div>' +
    '<div class="bg-white p-4 rounded-xl border shadow-sm"><div class="flex justify-between items-center mb-3 border-b pb-2"><h3 class="font-bold text-gray-800 text-sm">Обработка торцов</h3><label class="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded cursor-pointer border border-red-200"><input type="checkbox" id="calcIsThick"' +
    (data.isThickEdge ? " checked" : "") +
    ' class="calc-trigger"> СКЛЕЙКА (40мм)</label></div><div class="grid grid-cols-2 gap-4"><div><label class="block text-xs text-gray-500 mb-1">Фаска</label><label class="block text-xs mb-1 cursor-pointer"><input type="checkbox" id="cEF"' +
    (data.edgeFront ? " checked" : "") +
    ' class="calc-trigger"> Спереди</label><label class="block text-xs mb-1 cursor-pointer"><input type="checkbox" id="cEL"' +
    (data.edgeLeft ? " checked" : "") +
    ' class="calc-trigger"> Слева</label><label class="block text-xs mb-1 cursor-pointer"><input type="checkbox" id="cER"' +
    (data.edgeRight ? " checked" : "") +
    ' class="calc-trigger"> Справа</label></div><div><label class="block text-xs text-gray-500 mb-1">Плинтус</label><label class="block text-xs mb-1 cursor-pointer"><input type="checkbox" id="cPB"' +
    (data.plinthBack ? " checked" : "") +
    ' class="calc-trigger"> Сзади</label><label class="block text-xs mb-1 cursor-pointer"><input type="checkbox" id="cPL"' +
    (data.plinthLeft ? " checked" : "") +
    ' class="calc-trigger"> Слева</label><label class="block text-xs mb-1 cursor-pointer"><input type="checkbox" id="cPR"' +
    (data.plinthRight ? " checked" : "") +
    ' class="calc-trigger"> Справа</label></div></div>' +
    '<div class="mt-3 text-xs bg-gray-50 p-2 rounded border text-gray-600">Авто: Рез <span id="outCutS" class="font-bold text-blue-600">0</span>м | 45° <span id="outCut45" class="font-bold text-blue-600">0</span>м | Кромка <span id="outEdge" class="font-bold text-blue-600">0</span>м</div></div>' +
    '<div class="bg-white p-4 rounded-xl border shadow-sm"><h3 class="font-bold text-gray-800 mb-3 text-sm border-b pb-2">Вырезы</h3><div class="grid grid-cols-2 gap-3 text-xs"><div class="flex justify-between items-center bg-blue-50 p-1.5 rounded"><span>Мойка (низ)</span><input type="number" id="cSinkU" value="' +
    data.sinkUnder +
    '" min="0" class="w-12 border rounded text-center p-1 calc-trigger"></div>' +
    '<div class="flex justify-between items-center p-1.5"><span>Варка/Верх</span><input type="number" id="cSinkT" value="' +
    data.sinkTop +
    '" min="0" class="w-12 border rounded text-center p-1 calc-trigger"></div>' +
    '<div class="flex justify-between items-center p-1.5"><span>Стыки</span><input type="number" id="cJoint" value="' +
    data.joint +
    '" min="0" class="w-12 border rounded text-center p-1 calc-trigger"></div>' +
    '<div class="flex justify-between items-center p-1.5"><span>Отверстия</span><input type="number" id="cHole" value="' +
    data.hole +
    '" min="0" class="w-12 border rounded text-center p-1 calc-trigger"></div></div></div></div>' +
    '<div class="md:col-span-5 space-y-4 flex flex-col h-full">' +
    '<div class="bg-white p-4 rounded-xl border shadow-sm"><h3 class="font-bold text-gray-800 mb-3 text-sm border-b pb-2">Материал</h3><select id="cStone" class="w-full border rounded p-2 text-sm calc-trigger mb-3">' +
    oh +
    "</select>" +
    '<div class="flex gap-4"><div class="flex-1"><label class="flex justify-between text-xs font-bold text-gray-600 uppercase mb-1"><span>Расход (шт)</span><label class="flex items-center gap-1 text-blue-600 normal-case cursor-pointer"><input type="checkbox" id="calcAutoSlab"' +
    (data.isAutoSlab ? " checked" : "") +
    ' class="calc-trigger"> Авто</label></label><input type="number" id="cSlab" step="0.5" min="0" value="' +
    data.slabAmt +
    '"' +
    (data.isAutoSlab ? " disabled" : "") +
    ' class="w-full border rounded p-2 text-sm calc-trigger font-bold' +
    (data.isAutoSlab
      ? " bg-gray-100 text-gray-500"
      : " bg-yellow-50 border-yellow-300") +
    '"></div>' +
    '<div class="flex-1' +
    (data.stoneId !== "custom" ? " hidden" : "") +
    '" id="cCustomWrap"><label class="block text-xs font-bold text-gray-600 uppercase mb-1">Цена слэба ($)</label><input type="number" id="cCustomP" value="' +
    data.customSlabPrice +
    '" class="w-full border rounded p-2 text-sm calc-trigger bg-yellow-50"></div></div></div>' +
    '<div class="bg-white p-4 rounded-xl border shadow-sm flex gap-4"><div class="flex-1"><label class="block text-xs text-gray-500 mb-1">Доставка (BYN)</label><input type="number" id="cDel" value="' +
    data.deliveryBYN +
    '" class="w-full border rounded p-2 text-sm font-bold calc-trigger"></div><div class="flex-1"><label class="block text-xs text-gray-500 mb-1">Монтаж (BYN)</label><input type="number" id="cInst" value="' +
    data.installBYN +
    '" class="w-full border rounded p-2 text-sm font-bold calc-trigger"></div></div>' +
    '<div class="bg-white rounded-xl shadow-lg border overflow-hidden flex flex-col flex-1"><div class="bg-gray-800 p-3 text-center"><h3 class="text-sm font-bold text-white uppercase">Смета</h3></div><div class="p-4 flex-1 overflow-y-auto bg-gray-50 border-b"><div id="detailedReceipt" class="space-y-3 text-sm text-gray-700"></div></div><div class="p-4 bg-white"><div class="text-3xl font-black text-center text-[#D4AF37]"><span id="outTotal">0</span> <span class="text-lg">BYN</span></div><div class="text-center text-xs text-gray-400">$<span id="outTotalUSD">0</span></div></div></div></div></div>' +
    '<div class="bg-white px-6 py-4 border-t flex justify-end gap-3"><button id="cancelCalcBtn" class="px-4 py-2 border rounded text-sm font-medium hover:bg-gray-100">Отмена</button><button id="saveCalcBtn" class="px-6 py-2 bg-[#D4AF37] text-white rounded text-sm font-bold hover:bg-[#C49F2F] shadow-lg">💾 Сохранить</button></div></div>';
  overlay.innerHTML = modalHTML;
  document.body.appendChild(overlay);

  const calc = () => {
    const L = (Number(document.getElementById("calcL").value) || 0) / 1000,
      W = (Number(document.getElementById("calcW").value) || 0) / 1000,
      it = document.getElementById("calcIsThick").checked;
    let e = 0;
    if (document.getElementById("cEF").checked) e += L;
    if (document.getElementById("cEL").checked) e += W;
    if (document.getElementById("cER").checked) e += W;
    let p = 0;
    if (document.getElementById("cPB").checked) p += L;
    if (document.getElementById("cPL").checked) p += W;
    if (document.getElementById("cPR").checked) p += W;
    let cs = 0,
      c45 = 0;
    if (it) {
      c45 = e;
      cs = (L + W) * 2 + e;
    } else {
      cs = (L + W) * 2;
    }
    document.getElementById("outCutS").textContent = cs.toFixed(1);
    document.getElementById("outCut45").textContent = c45.toFixed(1);
    document.getElementById("outEdge").textContent = e.toFixed(1);
    const ac = document.getElementById("calcAutoSlab"),
      si = document.getElementById("cSlab");
    si.disabled = ac.checked;
    if (ac.checked) {
      si.classList.add("bg-gray-100", "text-gray-500");
      si.classList.remove("bg-yellow-50", "border-yellow-400");
      si.value = 0;
    } else {
      si.classList.remove("bg-gray-100", "text-gray-500");
      si.classList.add("bg-yellow-50", "border-yellow-400");
    }
    const sa = Number(si.value) || 0,
      rate = (() => {
        try {
          // Безопасный парсинг курса: битый JSON в localStorage не должен
          // ронять расчёт в NaN.
          return (
            Number(
              JSON.parse(localStorage.getItem("crm_settings") || "{}")
                .exchangeRate,
            ) || 3.2
          );
        } catch (error) {
          return 3.2;
        }
      })();
    let mu = 0;
    const ss = document.getElementById("cStone");
    document
      .getElementById("cCustomWrap")
      .classList.toggle("hidden", ss.value !== "custom");
    let sn = "Не выбран";
    if (ss.value === "custom") {
      mu = (Number(document.getElementById("cCustomP").value) || 0) * sa;
      sn = "Свой материал";
    } else if (ss.value !== "0") {
      const o = ss.options[ss.selectedIndex];
      sn = o.text;
      mu = Number(o.dataset.price || 0) * sa;
    }
    const ep = it ? PRICES.edge40 : PRICES.edge20,
      qsu = Number(document.getElementById("cSinkU").value) || 0,
      qst = Number(document.getElementById("cSinkT").value) || 0,
      qj = Number(document.getElementById("cJoint").value) || 0,
      qh = Number(document.getElementById("cHole").value) || 0;
    const pu =
      cs * PRICES.cutStraight +
      c45 * PRICES.cut45 +
      e * ep +
      p * PRICES.plinth +
      qsu * PRICES.sinkUnder +
      qst * PRICES.sinkTop +
      qj * PRICES.joint +
      qh * PRICES.hole;
    const db = Number(document.getElementById("cDel").value) || 0,
      ib = Number(document.getElementById("cInst").value) || 0,
      tb = db + ib;
    const tu = (mu + pu + tb) / rate,
      tbyn = tu * rate;
    let rh =
      '<div class="font-bold border-b pb-1 mb-2 text-[10px] uppercase text-gray-500">Материал</div><div class="flex justify-between text-xs"><span>' +
      sn +
      " (" +
      sa +
      ' шт)</span><span class="font-bold">$' +
      mu.toFixed(1) +
      "</span></div>";
    rh +=
      '<div class="font-bold border-b pb-1 mb-2 mt-4 text-[10px] uppercase text-gray-500">Работы</div>';
    if (cs > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Рез (' +
        cs.toFixed(1) +
        "м x $" +
        PRICES.cutStraight +
        ')</span><span class="font-bold">$' +
        (cs * PRICES.cutStraight).toFixed(1) +
        "</span></div>";
    if (c45 > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>45° (' +
        c45.toFixed(1) +
        "м x $" +
        PRICES.cut45 +
        ')</span><span class="font-bold">$' +
        (c45 * PRICES.cut45).toFixed(1) +
        "</span></div>";
    if (e > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Торец ' +
        (it ? "40" : "20") +
        "мм (" +
        e.toFixed(1) +
        "м x $" +
        ep +
        ')</span><span class="font-bold">$' +
        (e * ep).toFixed(1) +
        "</span></div>";
    if (p > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Плинтус (' +
        p.toFixed(1) +
        "м x $" +
        PRICES.plinth +
        ')</span><span class="font-bold">$' +
        (p * PRICES.plinth).toFixed(1) +
        "</span></div>";
    if (qsu > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Мойка (' +
        qsu +
        "шт x $" +
        PRICES.sinkUnder +
        ')</span><span class="font-bold">$' +
        (qsu * PRICES.sinkUnder).toFixed(1) +
        "</span></div>";
    if (qst > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Варка (' +
        qst +
        "шт x $" +
        PRICES.sinkTop +
        ')</span><span class="font-bold">$' +
        (qst * PRICES.sinkTop).toFixed(1) +
        "</span></div>";
    if (qj > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Стыки (' +
        qj +
        "шт x $" +
        PRICES.joint +
        ')</span><span class="font-bold">$' +
        (qj * PRICES.joint).toFixed(1) +
        "</span></div>";
    if (qh > 0)
      rh +=
        '<div class="flex justify-between text-xs mb-1"><span>Отверстия (' +
        qh +
        "шт x $" +
        PRICES.hole +
        ')</span><span class="font-bold">$' +
        (qh * PRICES.hole).toFixed(1) +
        "</span></div>";
    if (tb > 0)
      rh +=
        '<div class="font-bold border-b pb-1 mb-2 mt-4 text-[10px] uppercase text-gray-500">Логистика</div><div class="flex justify-between text-xs mb-1 text-blue-800"><span>Доставка+Монтаж</span><span class="font-bold">' +
        tb +
        " BYN</span></div>";
    document.getElementById("detailedReceipt").innerHTML = rh;
    document.getElementById("outTotalUSD").textContent = tu.toFixed(1);
    document.getElementById("outTotal").textContent =
      Math.round(tbyn).toLocaleString("ru-RU");
    return {
      matUSD: mu,
      prodUSD: pu,
      cutStraightM: cs,
      cut45M: c45,
      edgeM: e,
      plinthM: p,
      totalBYN: tbyn,
      stoneName: sn,
    };
  };
  document.querySelectorAll(".calc-trigger").forEach((i) => {
    if (io) {
      i.disabled = true;
      i.classList.add("opacity-60", "cursor-not-allowed");
    }
    i.addEventListener("input", calc);
    i.addEventListener("change", calc);
  });
  calc();
  document.getElementById("closeCalcBtn").onclick = () =>
    document.body.removeChild(overlay);
  document.getElementById("cancelCalcBtn").onclick = () =>
    document.body.removeChild(overlay);
  document.getElementById("saveCalcBtn").onclick = async () => {
    if (io) {
      alert("Этот заказ зафиксирован.");
      return;
    }
    const fr = calc(),
      ss = document.getElementById("cStone");
    const nd = {
      isInitialized: true,
      length: document.getElementById("calcL").value,
      width: document.getElementById("calcW").value,
      isThickEdge: document.getElementById("calcIsThick").checked,
      edgeFront: document.getElementById("cEF").checked,
      edgeLeft: document.getElementById("cEL").checked,
      edgeRight: document.getElementById("cER").checked,
      plinthBack: document.getElementById("cPB").checked,
      plinthLeft: document.getElementById("cPL").checked,
      plinthRight: document.getElementById("cPR").checked,
      stoneId: ss.value,
      stoneName: fr.stoneName,
      slabAmt: document.getElementById("cSlab").value,
      isAutoSlab: document.getElementById("calcAutoSlab").checked,
      customSlabPrice: document.getElementById("cCustomP").value,
      sinkUnder: document.getElementById("cSinkU").value,
      sinkTop: document.getElementById("cSinkT").value,
      joint: document.getElementById("cJoint").value,
      hole: document.getElementById("cHole").value,
      deliveryBYN: document.getElementById("cDel").value,
      installBYN: document.getElementById("cInst").value,
      cutStraight: fr.cutStraightM.toFixed(1),
      cut45: fr.cut45M.toFixed(1),
      edge20: document.getElementById("calcIsThick").checked
        ? 0
        : fr.edgeM.toFixed(1),
      edge40: document.getElementById("calcIsThick").checked
        ? fr.edgeM.toFixed(1)
        : 0,
      plinth: fr.plinthM.toFixed(1),
      matUSD: fr.matUSD,
      prodUSD: fr.prodUSD,
      suggestedTotal: fr.totalBYN,
    };
    if (order.id === "НОВЫЙ") {
      // Сохраняем в глобальную переменную (для handleCreateOrder)
      window.tempCalcData = nd;
      // И в localStorage — для восстановления после перезагрузки
      draftStorage.save("НОВЫЙ", nd);
      const si = document.getElementById("totalSumInput");
      if (si) {
        si.value = Math.round(nd.suggestedTotal);
        si.dispatchEvent(new Event("input"));
      }
      document.getElementById("stoneType") &&
        (document.getElementById("stoneType").value = nd.stoneName);
    } else {
      try {
        const calculatorResult = await api.updateOrderCalculator(
          order.order_id || order.id,
          {
          version: order.version,
          total_amount:
            Number(order.total_amount ?? order.sum ?? 0) > 0
              ? Number(order.total_amount ?? order.sum)
              : Math.round(nd.suggestedTotal),
          exchange_rate:
            JSON.parse(localStorage.getItem("crm_settings") || "{}")
              .exchangeRate || null,
          calculator_snapshot: nd,
          },
        );
        const refreshed = await api.getOrder(order.order_id || order.id);
        Object.assign(order, refreshed.order || refreshed, {
          version: calculatorResult.version,
        });
        if (currentOrderView) Object.assign(currentOrderView, order);
        renderOrderData(order, false);
        alert("Снимок сохранён.");
      } catch (e) {
        console.error("Ошибка:", e);
        alert("❌ " + e.message);
      }
    }
    document.body.removeChild(overlay);
  };
}
