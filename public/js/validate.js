// validate.js — проверка схем JSON и простые валидаторы форм.

/* ===================== ДОПУСТИМЫЕ ТИПЫ ===================== */
// Эти значения разрешены для полей type (в catalog.json) и material (в works.json)
const ALLOWED_TYPES = [
  "granite", // гранит
  "quartz", // кварц (агломерат)
  "marble", // мрамор
  "quartzite", // кварцит
  "quartz_agglomerate", // кварцевый агломерат (альтернативное название)
];

/* ===================== ПРОВЕРКА catalog.json ===================== */
export function validateCatalog(list) {
  // Должен быть массив объектов
  if (!Array.isArray(list)) return "catalog.json должен быть массивом";

  // Проверяем каждый элемент массива
  for (const i of list) {
    // Обязательные поля: id, type, title, desc, image
    if (!i.id || !i.type || !i.title || !i.desc || !i.image) {
      return "Каталог: нужны поля id, type, title, desc, image";
    }
    // Проверка: type должен быть из списка ALLOWED_TYPES
    if (!ALLOWED_TYPES.includes(i.type)) {
      return `Каталог: недопустимый type=${i.type}`;
    }
  }
  return ""; // пустая строка = ошибок нет
}

/* ===================== ПРОВЕРКА works.json ===================== */
export function validateWorks(list) {
  if (!Array.isArray(list)) return "works.json должен быть массивом";

  for (const i of list) {
    const materials = Array.isArray(i.material)
      ? i.material
      : i.material
        ? [i.material]
        : [];
    const hasImages = Array.isArray(i.images)
      ? i.images.length > 0
      : Boolean(i.image);

    // Обязательные поля: id, material(s), title, location, desc, images/image
    if (
      !i.id ||
      !materials.length ||
      !i.title ||
      !i.location ||
      !i.desc ||
      !hasImages
    ) {
      return "Работы: нужны id, material, title, location, desc и минимум одно изображение";
    }

    // Проверяем каждый material
    for (const m of materials) {
      if (!ALLOWED_TYPES.includes(m)) {
        return `Работы: недопустимый material=${m}`;
      }
    }
  }
  return "";
}

/* ===================== ПРОВЕРКА content.json ===================== */
export function validateContent(obj) {
  // content.json должен быть объектом
  if (typeof obj !== "object" || obj === null)
    return "content.json должен быть объектом";

  // Проверяем наличие ключевых разделов
  const need = ["project", "contacts", "social", "map"];
  for (const k of need) if (!(k in obj)) return `Отсутствует раздел: ${k}`;

  const { project, contacts, social, map } = obj;

  // Проверяем project
  if (!project.name || !project.logo || !project.address)
    return "project: name, logo, address — обязательны";

  // Проверяем contacts (поддержка новых phones и старого phone)
  if (!contacts.phones?.length && !contacts.phone)
    return "contacts: phones или phone — обязательны";
  if (!contacts.email) return "contacts: email — обязателен";

  // Проверяем social
  if (!social.telegram || !social.instagram)
    return "social: telegram, instagram — обязательны";

  // Проверяем карту
  if (typeof map.lat !== "number" || typeof map.lng !== "number")
    return "map.lat/map.lng должны быть числами";

  return ""; // ошибок нет
}

/* ===================== ВАЛИДАТОРЫ ФОРМ ===================== */
// Проверка e-mail через простую регулярку
export const isEmail = (v) => /.+@.+\..+/.test(String(v));

// Проверка телефона (допускаем +, цифры, пробелы, скобки, дефис)
export const isPhone = (v) => /[+0-9()\s\-]{7,}/.test(String(v));

/* ===================== SAFE PARSE ===================== */
/**
 * Безопасный JSON.parse.
 * Если JSON некорректный — не падает, а возвращает fallback (по умолчанию null).
 */
export function safeParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
