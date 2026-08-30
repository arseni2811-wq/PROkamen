const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeMultipartFilename,
  safeDisplayFilename,
  attachmentContentDisposition,
} = require("../utils/filenames");

function multerLatin1View(filename) {
  return Buffer.from(filename, "utf8").toString("latin1");
}

test("multipart filenames recover Russian, Belarusian and Latin Unicode", () => {
  const names = [
    "Договор на изготовление столешницы.pdf",
    "Здымак экрана ў Мінску.png",
    "contract-tabletop.pdf",
  ];
  for (const name of names) {
    assert.equal(normalizeMultipartFilename(multerLatin1View(name)), name);
    assert.equal(safeDisplayFilename(multerLatin1View(name)), name);
  }
});

test("filename repair is not applied to invalid non-UTF8 Latin-1", () => {
  assert.equal(normalizeMultipartFilename("café.pdf"), "café.pdf");
});

test("Content-Disposition provides ASCII fallback and RFC 5987 Unicode name", () => {
  const name = "Договор на изготовление столешницы.pdf";
  const header = attachmentContentDisposition(name);
  assert.match(header, /^attachment; filename="[\x20-\x7E]+";/);
  assert.ok(header.includes("filename*=UTF-8''"));
  assert.ok(header.includes(encodeURIComponent("Договор")));
  assert.equal(header.includes("\r"), false);
  assert.equal(header.includes("\n"), false);
});
