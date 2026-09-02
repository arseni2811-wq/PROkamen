const path = require("path");

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

function startsWith(buffer, signature) {
  return (
    buffer.length >= signature.length &&
    buffer.subarray(0, signature.length).equals(signature)
  );
}

function hasAllowedFileSignature(filename, header) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf") return header.subarray(0, 5).toString() === "%PDF-";
  if (extension === ".png") {
    return startsWith(
      header,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if ([".jpg", ".jpeg"].includes(extension)) {
    return startsWith(header, Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (extension === ".webp") {
    return (
      header.length >= 12 &&
      header.subarray(0, 4).toString() === "RIFF" &&
      header.subarray(8, 12).toString() === "WEBP"
    );
  }
  if ([".docx", ".xlsx"].includes(extension)) {
    return startsWith(header, ZIP_SIGNATURE);
  }
  if ([".doc", ".xls"].includes(extension)) {
    return startsWith(header, OLE_SIGNATURE);
  }
  if (extension === ".dwg") {
    return header.length >= 6 && /^AC10\d{2}$/.test(header.subarray(0, 6).toString("ascii"));
  }
  return false;
}

module.exports = { hasAllowedFileSignature };
