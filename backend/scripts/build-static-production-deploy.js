const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const publicDir = path.join(projectRoot, "public");
const outputName = process.argv[2] || "prokamen-public";
if (!/^[a-z0-9][a-z0-9-]*$/i.test(outputName)) {
  throw new Error("Deploy directory name may contain only letters, digits and hyphens");
}
const deployDir = path.join(projectRoot, "deploy", outputName);

if (fs.existsSync(deployDir)) {
  throw new Error(`Deploy directory already exists: ${deployDir}`);
}

const copyFile = (relativePath) => {
  const source = path.join(publicDir, relativePath);
  const destination = path.join(deployDir, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Required public file is missing: ${relativePath}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

const copyDirectory = (relativePath) => {
  const source = path.join(publicDir, relativePath);
  const destination = path.join(deployDir, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Required public directory is missing: ${relativePath}`);
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (entry) => ![".DS_Store", "Thumbs.db"].includes(path.basename(entry)),
  });
};

[
  ".htaccess",
  "404.html",
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "css/base.css",
  "css/layout.css",
  "css/components.css",
  "js/main.js",
  "js/storage.js",
  "js/landing.js",
  "js/metrika.js",
  "assets/data/catalog.json",
  "assets/data/content.json",
  "assets/data/project-slugs.json",
  "assets/data/works.json",
  "pages/about.html",
  "pages/calculator.html",
  "pages/catalog.html",
  "pages/contacts.html",
  "pages/kvarcevyj-aglomerat.html",
  "pages/podokonniki.html",
  "pages/services.html",
  "pages/stoleshnicy.html",
  "pages/stoleshnicy-dlya-kuhni.html",
  "pages/stoleshnicy-dlya-vannoy.html",
  "pages/stoleshnicy-iz-kvarca.html",
  "pages/works.html",
].forEach(copyFile);
copyDirectory("assets/images");
copyDirectory("pages/works");

const forbiddenNames = new Set([
  ".env",
  "id_rsa",
  "id_ed25519",
  ".DS_Store",
  "Thumbs.db",
]);
const forbiddenPatterns = [/^backup/i, /\.(?:log|sql|pem|key)$/i];
const findings = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (
      forbiddenNames.has(entry.name) ||
      forbiddenPatterns.some((pattern) => pattern.test(entry.name))
    ) {
      findings.push(path.relative(deployDir, fullPath));
    }
  }
};
walk(deployDir);
if (findings.length) {
  throw new Error(`Forbidden files in deploy package: ${findings.join(", ")}`);
}

console.log(`Static production package prepared: ${deployDir}`);
