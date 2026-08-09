// storage.js — единый доступ к данным каталога/работ/контента.
// Логика: сначала пробуем получить свежие JSON-файлы из /assets/data,
// а если запрос не удался (офлайн и т.п.), используем кэш из localStorage.

/* ===================== ПУТИ К JSON ===================== */
// Рассчитываем пути относительно текущего скрипта, чтобы игнорировать <base>
const VERSION = "2025-02-15"; // обновляйте при изменении данных

const withVersion = (path) => {
  const url = new URL(path, import.meta.url);
  url.searchParams.set("v", VERSION);
  return url.href;
};

const PATHS = {
  catalog: withVersion("../assets/data/catalog.json"), // каталог камня
  works: withVersion("../assets/data/works.json"), // выполненные работы
  content: withVersion("../assets/data/content.json"), // общий контент (контакты, соцсети, адрес и т.д.)
};

/* ===================== КЛЮЧИ ДЛЯ localStorage ===================== */
// Все данные в localStorage храним под уникальными ключами
// Чтобы не пересекались с другими сайтами
const LS = {
  catalog: "prokamень:catalog",
  works: "prokamень:works",
  content: "prokamень:content",
};

/* ===================== СЛУЖЕБНЫЕ ФУНКЦИИ ===================== */
// Загружает JSON с сервера
async function fetchJSON(url) {
  const res = await fetch(url, { credentials: "same-origin" }); // грузим файл
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json(); // парсим JSON
}

// Проверка: существует ли такой ключ (catalog, works, content)
function ensureKey(key) {
  if (!(key in PATHS)) throw new Error(`Unknown dataset: ${key}`);
}

/* ===================== ОСНОВНЫЕ ФУНКЦИИ ===================== */

/** Получение данных (объект/массив).
 * Приоритет: сначала свежие данные с сервера → затем кэш из localStorage.
 */
export async function getData(key) {
  ensureKey(key);

  try {
    const fresh = await fetchJSON(PATHS[key]);
    try {
      localStorage.setItem(LS[key], JSON.stringify(fresh));
    } catch (err) {
      console.warn(`⚠️ Не удалось сохранить ${key} в localStorage:`, err);
    }
    return fresh;
  } catch (networkError) {
    const cached = localStorage.getItem(LS[key]);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        console.warn(`⚠️ Повреждён JSON в localStorage: ${LS[key]}`);
      }
    }
    throw networkError;
  }
}

/** Сохраняем данные в localStorage */
export function setData(key, data) {
  ensureKey(key);
  localStorage.setItem(LS[key], JSON.stringify(data));
}

/** Удаляем данные из localStorage (чтобы снова читался оригинальный файл) */
export function clearData(key) {
  ensureKey(key);
  localStorage.removeItem(LS[key]);
}

/** Скачивание данных в виде JSON-файла (например, для бэкапа) */
export function downloadData(key, data, filename) {
  ensureKey(key);
  const name = filename || `${key}.json`; // имя файла
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  // создаём временную ссылку <a>, чтобы скачать файл
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click(); // скачивание
  a.remove();

  // освобождаем память
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ===================== УТИЛИТЫ ДЛЯ ССЫЛОК ===================== */
// Формируем корректные ссылки для телефона и почты
export const telLink = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;
export const mailtoLink = (email) => `mailto:${email}`;

/* ===================== ЭКСПОРТ ===================== */
// Чтобы при необходимости можно было использовать напрямую
export { PATHS, LS };
