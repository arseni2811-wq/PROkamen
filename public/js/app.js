// =========================================================
// app.js — каталог материалов: price.csv → HTML-таблица
// Чистый JavaScript (ES Module), без библиотек.
//
// Подключается так:
//   <script type="module" src="/js/app.js"></script>
// Контейнер для таблицы:
//   <div id="table-container"></div>
// =========================================================

const CSV_URL = "/assets/data/price.csv";
const CONTAINER_ID = "table-container";

// =========================================================
// 1. ОПРЕДЕЛЕНИЕ РАЗДЕЛИТЕЛЯ (`;` или `,`)
// Считаем разделители в первой непустой строке ВНЕ кавычек.
// =========================================================
export function detectDelimiter(text) {
  const firstLine =
    text.trim().split(/\r?\n/).find((line) => line.trim() !== "") || "";

  const counts = { ",": 0, ";": 0 };
  let inQuotes = false;

  for (const ch of firstLine) {
    if (ch === '"') {
      inQuotes = !inQuotes; // кавычка открывает/закрывает поле
    } else if (!inQuotes && (ch === "," || ch === ";")) {
      counts[ch] += 1;
    }
  }

  return counts[";"] > counts[","] ? ";" : ",";
}

// =========================================================
// 2. ПАРСИНГ CSV → массив объектов
// Учитывает: кавычки, экранированные кавычки (""), переносы
// строк (LF/CRLF), пустые поля; первая строка — заголовки.
// =========================================================
export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const flushField = () => {
    row.push(field);
    field = "";
  };

  const flushRow = () => {
    flushField();
    // Пропускаем полностью пустые строки
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // экранирование кавычки: "" → "
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      flushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1; // CRLF → один разделитель
      flushRow();
    } else {
      field += ch;
    }
  }

  // Последняя строка, если в конце нет перевода строки
  if (field !== "" || row.length > 0) flushRow();
  if (rows.length === 0) return [];

  // Первая строка — заголовки, остальные — объекты данных
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

// =========================================================
// 3. РЕНДЕР HTML-ТАБЛИЦЫ
// Собираем через createElement + textContent — без innerHTML,
// поэтому значения из CSV не ломают разметку (защита от XSS).
// =========================================================
export function renderTable(rows, container) {
  container.replaceChildren();

  const info = document.createElement("p");
  info.className = "table-info";
  info.textContent = `Каталог материалов: ${rows.length} позиций`;

  const table = document.createElement("table");
  table.className = "data-table";

  const headers = Object.keys(rows[0]);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  rows.forEach((record) => {
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const td = document.createElement("td");
      td.textContent = record[header] || "—";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  container.append(info, table);
}

// =========================================================
// 4. ОТОБРАЖЕНИЕ ОШИБКИ В ИНТЕРФЕЙСЕ
// =========================================================
export function renderError(container, message) {
  container.replaceChildren();

  const box = document.createElement("div");
  box.className = "price-error";
  box.setAttribute("role", "alert");

  const title = document.createElement("strong");
  title.textContent = "Не удалось загрузить каталог материалов.";

  const detail = document.createElement("span");
  detail.textContent = message;

  box.append(title, detail);
  container.appendChild(box);
}

// =========================================================
// 5. ЗАГРУЗКА + try/catch
// =========================================================
export async function loadPriceTable(container) {
  try {
    const response = await fetch(CSV_URL, { credentials: "same-origin" });

    if (!response.ok) {
      throw new Error(`Сервер ответил: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // Защита от SPA-fallback: если price.csv отсутствует, сервер
    // отдаёт index.html со статусом 200 — проверяем, что это CSV
    if (!text.trim()) {
      throw new Error("Файл price.csv пуст.");
    }
    if (contentType.includes("text/html") || /^\s*</.test(text.slice(0, 256))) {
      throw new Error(
        `Файл price.csv не найден (${CSV_URL}). Проверьте, что он лежит в public/assets/data/`,
      );
    }

    const rows = parseCSV(text);
    if (rows.length === 0) {
      throw new Error("В price.csv нет данных (только заголовки или пустой файл).");
    }

    renderTable(rows, container);
  } catch (error) {
    console.error("Ошибка загрузки price.csv:", error);
    renderError(container, error.message);
  }
}

// =========================================================
// 6. ТОЧКА ВХОДА
// =========================================================
export function init() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn(`Контейнер #${CONTAINER_ID} не найден — рендер пропущен`);
    return;
  }
  loadPriceTable(container);
}

// Автозапуск в браузере (guard нужен, чтобы модуль можно было
// импортировать в Node.js для unit-тестов парсера)
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}