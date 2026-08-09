// render.js — чистые функции рендера каталога и работ.
// Эти функции ничего не загружают и не меняют в хранилище,
// а только принимают данные (JSON-объекты) и возвращают/отрисовывают HTML.

/* ===================== ЭКРАНИРОВАНИЕ HTML ===================== */
// Функция escapeHTML нужна, чтобы "чистить" строки от спецсимволов
// и не допустить XSS (например, чтобы пользователь не вставил <script>).
function escapeHTML(s = "") {
  return String(s)
    .replace(/&/g, "&amp;") // заменяем &
    .replace(/</g, "&lt;") // заменяем <
    .replace(/>/g, "&gt;") // заменяем >
    .replace(/"/g, "&quot;") // заменяем "
    .replace(/'/g, "&#39;"); // заменяем '
}

/* ===================== КАРТОЧКА КАТАЛОГА ===================== */
// Принимает объект материала (m) и возвращает HTML-карточку
function tplCatalogCard(m) {
  const img = m.image ? escapeHTML(m.image) : "/assets/images/ui/ph-3x2.webp"; // картинка или плейсхолдер
  const title = escapeHTML(m.title || "Образец"); // заголовок
  const desc = escapeHTML(m.desc || ""); // описание
  const type = escapeHTML(m.typeRu || m.type || "материал"); // тип материала
  const size = escapeHTML(m.sizeMm || "—"); // размер
  const fabricator = escapeHTML(m.fabricator || "—"); // производитель

  return `
    <article class="card" data-type="${type}">
      <div class="work-card__media" aria-hidden="true">
        <img src="${img}" alt="Образец: ${title}" loading="lazy">
      </div>
      <div class="chips"><span class="badge">${type}</span></div>
      <h3>${title}</h3>
      <p class="muted">${desc}</p>
      <ul class="spec">
        <li><b>Материал:</b> ${type}</li>
        <li><b>Размер:</b> ${size} мм</li>
        <li><b>Производитель:</b> ${fabricator}</li>
      </ul>
      <a class="btn" href="/pages/contacts.html#request">Запросить расчёт</a>
    </article>`;
}

/* ===================== КАРТОЧКА РАБОТЫ ===================== */
// Принимает объект работы (w) и возвращает HTML-карточку
function tplWorkCard(w) {
  const img = w.image ? escapeHTML(w.image) : "/assets/images/ui/ph-3x2.webp"; // картинка
  const title = escapeHTML(w.title || "Проект"); // название работы
  const desc = escapeHTML(w.desc || ""); // описание
  const material = escapeHTML(w.materialRu || w.material || "—"); // материал
  const location = escapeHTML(w.location || "—"); // место

  return `
    <article class="work-card" data-material="${material}">
      <a class="work-card__media" href="${img}" target="_blank" rel="noopener">
        <img src="${img}" alt="${title}" loading="lazy" width="480" height="320">
      </a>
      <div class="work-card__body">
        <h3 class="work-card__title">${title}</h3>
        <ul class="work-card__meta">
          <li><strong>Материал:</strong> ${material}</li>
          <li><strong>Локация:</strong> ${location}</li>
        </ul>
        <p class="work-card__desc">${desc}</p>
      </div>
    </article>`;
}

/* ===================== РЕНДЕР СЕТКИ ===================== */
// Отрисовывает список карточек каталога в контейнер
export function renderCatalogGrid(list, container) {
  const host =
    typeof container === "string"
      ? document.querySelector(container) // если передали селектор
      : container; // или сразу элемент
  if (!host) return;
  host.innerHTML = (list || []).map(tplCatalogCard).join("");
}

// Отрисовывает список карточек работ в контейнер
export function renderWorksGrid(list, container) {
  const host =
    typeof container === "string"
      ? document.querySelector(container)
      : container;
  if (!host) return;
  host.innerHTML = (list || []).map(tplWorkCard).join("");
}

/* ===================== ФИЛЬТРЫ ===================== */
// Общая функция для "чипов" фильтра (кнопок типа "Все", "Гранит", "Мрамор")
export function bindChipFilter({
  chipsSelector, // селектор блока с кнопками-фильтрами
  onChange, // что делать при смене фильтра (например, перерисовать карточки)
  allowed, // допустимые значения фильтра
  param = "type", // имя query-параметра в URL (по умолчанию ?type=...)
}) {
  const root = document.querySelector(chipsSelector);
  if (!root) return;

  const chips = Array.from(root.querySelectorAll(".chip"));

  // Применение фильтра: обновляем UI, вызываем onChange, меняем URL
  function apply(value) {
    chips.forEach((b) => {
      const active = b.dataset.type === value;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    onChange(value); // вызываем переданную функцию с новым значением

    // обновляем URL, чтобы фильтр был виден в адресной строке (?type=granite)
    const next = new URL(location.href);
    if (value === "all") next.searchParams.delete(param);
    else next.searchParams.set(param, value);
    history.replaceState(null, "", next);
  }

  // Обработка кликов по кнопкам
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const type = btn.dataset.type;
    if (allowed && !allowed.includes(type)) return; // если тип не разрешён
    apply(type);
  });

  // Стартовое значение фильтра берём из URL (?type=...)
  const urlValue = new URL(location.href).searchParams.get(param) || "all";
  apply(allowed && allowed.includes(urlValue) ? urlValue : "all");
}
