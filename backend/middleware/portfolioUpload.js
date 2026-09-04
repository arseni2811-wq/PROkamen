const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { hasAllowedFileSignature } = require("../utils/fileSignatures");
const ALLOWED = new Map([[".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"], [".webp", "image/webp"]]);
const storage = multer.diskStorage({
  destination(req, file, callback) {
    const uploadRoot = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
    const directory = path.join(uploadRoot, "portfolio", String(req.params.id));
    fs.mkdirSync(directory, { recursive: true }); callback(null, directory);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, ALLOWED.get(extension) === file.mimetype);
  },
});
async function removeUploaded(files) {
  await Promise.all((files || []).map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
}
function handlePortfolioUpload(req, res, next) {
  upload.array("images", 20)(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ success: false, message: error.code === "LIMIT_FILE_SIZE"
      ? "Фотография превышает лимит 15 МБ" : "Разрешены только JPG, PNG и WebP (не более 20 файлов)" });
  });
}
async function validatePortfolioSignatures(req, res, next) {
  try {
    for (const file of req.files || []) {
      const handle = await fs.promises.open(file.path, "r"); const header = Buffer.alloc(16); let bytesRead;
      try { ({ bytesRead } = await handle.read(header, 0, header.length, 0)); } finally { await handle.close(); }
      if (!hasAllowedFileSignature(file.originalname, header.subarray(0, bytesRead))) {
        await removeUploaded(req.files);
        return res.status(400).json({ success: false, message: "Содержимое фотографии не соответствует расширению" });
      }
    }
    next();
  } catch (error) { await removeUploaded(req.files); next(error); }
}
module.exports = { handlePortfolioUpload, validatePortfolioSignatures, removeUploaded, ALLOWED };
