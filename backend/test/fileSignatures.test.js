const test = require("node:test");
const assert = require("node:assert/strict");
const { hasAllowedFileSignature } = require("../utils/fileSignatures");

test("file signatures accept matching supported formats", () => {
  assert.equal(hasAllowedFileSignature("a.pdf", Buffer.from("%PDF-1.7")), true);
  assert.equal(
    hasAllowedFileSignature(
      "a.png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    true,
  );
  assert.equal(
    hasAllowedFileSignature("a.docx", Buffer.from([0x50, 0x4b, 0x03, 0x04])),
    true,
  );
});

test("file signatures reject extension spoofing", () => {
  assert.equal(
    hasAllowedFileSignature("payload.png", Buffer.from("<script>")),
    false,
  );
  assert.equal(
    hasAllowedFileSignature("payload.pdf", Buffer.from([0xff, 0xd8, 0xff])),
    false,
  );
});
