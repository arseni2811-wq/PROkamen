const fs = require("fs");
const path = require("path");

const publicDir = path.resolve(__dirname, "..", "..", "public");
const projectSlugs = new Set(
  Object.values(
    JSON.parse(
      fs.readFileSync(
        path.join(publicDir, "assets", "data", "project-slugs.json"),
        "utf8",
      ),
    ),
  ),
);
const htmlFiles = [];
const prettyRoutes = new Set([
  "/catalog/",
  "/services/",
  "/works/",
  "/about/",
  "/contacts/",
  "/calculator/",
  "/stoleshnicy/",
  "/stoleshnicy/dlya-kuhni/",
  "/stoleshnicy/iz-kvarca/",
  "/stoleshnicy/dlya-vannoy/",
  "/podokonniki/",
  "/materialy/kvarcevyj-aglomerat/",
]);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(fullPath);
  }
}

function localTarget(htmlFile, reference) {
  const clean = reference.split("#")[0].split("?")[0].trim();
  if (
    !clean ||
    clean.startsWith("#") ||
    clean.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(clean) ||
    clean.includes("${") ||
    clean.includes("{{")
  ) {
    return null;
  }
  // Extensionless links are application routes, not static file references.
  if (!path.extname(clean) && !clean.endsWith("/")) return null;
  // These trailing-slash links are served by Express public routes, not files.
  if (prettyRoutes.has(clean)) return null;
  if (
    /^\/works\/[^/]+\/$/.test(clean) &&
    projectSlugs.has(clean.slice("/works/".length, -1))
  ) {
    return null;
  }
  return clean.startsWith("/")
    ? path.join(publicDir, clean)
    : path.resolve(path.dirname(htmlFile), clean);
}

walk(publicDir);
const missing = [];
const pattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(pattern)) {
    const target = localTarget(htmlFile, match[1]);
    if (target && !fs.existsSync(target)) {
      missing.push({
        file: path.relative(publicDir, htmlFile),
        reference: match[1],
      });
    }
  }
}

if (missing.length > 0) {
  console.error(JSON.stringify({ success: false, missing }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ success: true, html_files: htmlFiles.length, missing: 0 }));
}
