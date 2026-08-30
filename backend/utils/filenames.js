const path = require("path");

function normalizeMultipartFilename(value) {
  const original = path.basename(String(value || "").replace(/\\/g, "/"));
  if (!original) return original;

  // Busboy/Multer по умолчанию трактует bytes параметра filename как
  // Latin-1. Современные браузеры фактически отправляют UTF-8. Исправляем
  // только доказанный обратимый случай: candidate должен быть валидным UTF-8
  // и при обратном преобразовании дать исходную строку byte-for-byte.
  const candidate = Buffer.from(original, "latin1").toString("utf8");
  if (candidate.includes("\uFFFD")) return original;
  if (Buffer.from(candidate, "utf8").toString("latin1") !== original) {
    return original;
  }
  return candidate;
}

function safeDisplayFilename(value) {
  return normalizeMultipartFilename(value)
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

function encodeRFC5987(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function attachmentContentDisposition(filename) {
  const safeName = safeDisplayFilename(filename) || "attachment";
  const extension = path.extname(safeName).replace(/[^.A-Za-z0-9_-]/g, "");
  let fallback = safeName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .trim();
  if (!fallback || /^_+(?:\.[A-Za-z0-9_-]+)?$/.test(fallback)) {
    fallback = `attachment${extension}`;
  }
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRFC5987(safeName)}`;
}

module.exports = {
  normalizeMultipartFilename,
  safeDisplayFilename,
  attachmentContentDisposition,
};
