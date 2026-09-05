const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
let publicDir = path.join(projectRoot, "public");
let works = JSON.parse(
  fs.readFileSync(path.join(publicDir, "assets", "data", "works.json"), "utf8"),
);
let slugs = JSON.parse(
  fs.readFileSync(
    path.join(publicDir, "assets", "data", "project-slugs.json"),
    "utf8",
  ),
);
let outputDir = path.join(publicDir, "pages", "works");
let sitemapPath = path.join(publicDir, "sitemap.xml");

const landingByWork = {
  "w-001": "/podokonniki/",
  "w-002": "/stoleshnicy/dlya-vannoy/",
  "w-003": "/stoleshnicy/dlya-vannoy/",
  "w-004": "/podokonniki/",
  "w-005": "/stoleshnicy/iz-kvarca/",
  "w-006": "/stoleshnicy/",
  "w-007": "/stoleshnicy/",
  "w-008": "/stoleshnicy/",
  "w-009": "/stoleshnicy/iz-kvarca/",
  "w-010": "/stoleshnicy/",
  "w-011": "/stoleshnicy/dlya-vannoy/",
  "w-012": "/stoleshnicy/",
  "w-013": "/stoleshnicy/iz-kvarca/",
  "w-014": "/stoleshnicy/iz-kvarca/",
  "w-015": "/stoleshnicy/",
  "w-016": "/stoleshnicy/dlya-kuhni/",
};

const productTypeByWork = {
  "w-001": "Подоконник",
  "w-002": "Столешница для ванной",
  "w-003": "Столешница для ванной",
  "w-004": "Подоконник",
  "w-005": "Каминная полка",
  "w-006": "Столешница для журнального столика",
  "w-007": "Столешница для обеденного столика",
  "w-008": "Столешница для уличной беседки",
  "w-009": "Столешница",
  "w-010": "Уличный комплекс",
  "w-011": "Столешница для ванной",
  "w-012": "Уличный комплекс",
  "w-013": "Столешницы",
  "w-014": "Ступенька входной группы и журнальный столик",
  "w-015": "Столешница для уличной кухни и фартук",
  "w-016": "Столешница для кухни",
};

const pageNameByWork = {
  "w-014": "Ступенька входной группы и журнальный столик на металлическом основании — Бобруйск",
};

const metaTitleByWork = {
  "w-015": "Столешница Kimen Red и фартук Aurora — Бобруйск",
  "w-016": "Столешница Q757 Calacatta Aurum — Москва",
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function imageSize(file) {
  const data = fs.readFileSync(file);
  if (data[0] === 0x89 && data.toString("ascii", 1, 4) === "PNG") {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    const kind = data.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
    if (kind === "VP8L") return {
      width: 1 + (((data[22] & 0x3f) << 8) | data[21]),
      height: 1 + (((data[24] & 0x0f) << 10) | (data[23] << 2) | ((data[22] & 0xc0) >> 6)),
    };
    const marker = data.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
    if (marker >= 0) return { width: data.readUInt16LE(marker + 3) & 0x3fff, height: data.readUInt16LE(marker + 5) & 0x3fff };
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset < data.length) {
      if (data[offset] !== 0xff) { offset += 1; continue; }
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  throw new Error(`Unsupported or invalid project image: ${file}`);
}

function imageMarkup(work, index) {
  const imageUrl = work.images[index];
  const imagePath = path.join(publicDir, imageUrl.replace(/^\//, ""));
  const dimensions = imageSize(imagePath);
  const attributes = index === 0 ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  const alt = work.imageAlts?.[index] || `${work.title} — фото ${index + 1}`;
  const sizeAttributes = `width="${dimensions.width}" height="${dimensions.height}"`;
  return `<figure class="project-gallery__item${index === 0 ? " project-gallery__item--hero" : ""}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" ${sizeAttributes} ${attributes}></figure>`;
}

function relatedWorks(work, indexableWorks) {
  const ownMaterials = new Set(Array.isArray(work.material) ? work.material : [work.material]);
  return indexableWorks
    .filter((candidate) => candidate.id !== work.id)
    .filter((candidate) => {
      const candidateMaterials = Array.isArray(candidate.material)
        ? candidate.material
        : [candidate.material];
      return candidateMaterials.some((material) => ownMaterials.has(material));
    })
    .slice(0, 3);
}

function linkedSection(work) {
  const landing = landingByWork[work.id] || "/works/";
  const links = [
    `<a class="btn btn-primary" href="${landing}">Подобрать изделие</a>`,
    `<a class="btn btn-outline" href="/calculator/">Рассчитать изделие</a>`,
    `<a href="/works/">Смотреть все работы</a>`,
    `<a href="/catalog/">Смотреть каталог камня</a>`,
  ];
  if (String(work.materialRu).includes("кварцевый агломерат")) {
    links.splice(2, 0, `<a href="/materialy/kvarcevyj-aglomerat/">О кварцевом агломерате</a>`);
  }
  return links.join("\n              ");
}

function renderPage(work, indexableWorks) {
  const slug = slugs[work.id];
  const pageName = pageNameByWork[work.id] || [work.title, work.location].filter(Boolean).join(" — ");
  const metaTitle = work.seoTitle || metaTitleByWork[work.id] || pageName;
  const canonicalPath = `/works/${slug}/`;
  const canonical = `https://prokamen.by${canonicalPath}`;
  const description = work.seoDescription || `${pageName}. Реализованный проект PRO Камень: ${work.materialRu}.`;
  const related = relatedWorks(work, indexableWorks);
  const breadcrumbs = [
    { name: "Главная", item: "https://prokamen.by/" },
    { name: "Наши работы", item: "https://prokamen.by/works/" },
    { name: pageName, item: canonical },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: pageName,
      url: canonical,
      description,
      primaryImageOfPage: {
        "@type": "ImageObject",
        contentUrl: `https://prokamen.by${work.images[0]}`,
        caption: `${pageName} — фото 1`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.item,
      })),
    },
  ];

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <title>${escapeHtml(metaTitle)} — реализованный проект | PRO Камень</title>
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:site_name" content="PRO Камень">
  <meta property="og:title" content="${escapeHtml(pageName)} — PRO Камень">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="https://prokamen.by${escapeHtml(work.images[0])}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageName)} — PRO Камень">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="https://prokamen.by${escapeHtml(work.images[0])}">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="icon" href="/assets/images/ui/favicon.ico">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")}</script>
</head>
<body class="page page-project">
  <a class="skip-link" href="#main">Перейти к содержимому</a>
  <header class="header" role="banner"></header>
  <nav class="breadcrumbs" aria-label="Хлебные крошки"><div class="container"><ol class="breadcrumbs__list"><li><a href="/">Главная</a></li><li><a href="/works/">Наши работы</a></li><li><span aria-current="page">${escapeHtml(pageName)}</span></li></ol></div></nav>
  <main id="main">
    <section class="section section-hero project-hero"><div class="container">
      <p class="eyebrow">Реализованный проект</p>
      <h1 class="section-title">${escapeHtml(pageName)}</h1>
      <dl class="project-facts">${work.workType || productTypeByWork[work.id] ? `<div><dt>Тип изделия</dt><dd>${escapeHtml(work.workType || productTypeByWork[work.id])}</dd></div>` : ""}${work.materialRu ? `<div><dt>Материал</dt><dd>${escapeHtml(work.materialRu)}</dd></div>` : ""}${work.location ? `<div><dt>Локация</dt><dd>${escapeHtml(work.location)}</dd></div>` : ""}</dl>
      <p class="section-subtitle project-description">${escapeHtml(work.desc)}</p>
    </div></section>
    <section class="section" aria-labelledby="gallery-title"><div class="container"><h2 id="gallery-title" class="section-title section-title--small">Фотографии проекта</h2><div class="gallery project-gallery">${work.images.map((_, index) => imageMarkup(work, index)).join("\n")}</div></div></section>
    <section class="section section-muted" aria-labelledby="project-details-title"><div class="container kv"><div><h2 id="project-details-title" class="section-title section-title--small">О проекте</h2><p>${escapeHtml(work.desc)}</p></div><aside class="card project-links"><h2 class="section-title section-title--small">Связанные разделы</h2>${linkedSection(work)}</aside></div></section>
    ${related.length ? `<section class="section" aria-labelledby="related-projects-title"><div class="container"><h2 id="related-projects-title" class="section-title section-title--small">Другие реализованные проекты</h2><ul class="project-related">${related.map((item) => `<li><a href="/works/${slugs[item.id]}/">${escapeHtml(item.title)}</a><span>${escapeHtml(item.materialRu)} · ${escapeHtml(item.location)}</span></li>`).join("")}</ul></div></section>` : ""}
  </main>
  <footer class="footer" role="contentinfo"></footer>
  <script src="/js/metrika.js" defer></script>
  <script type="module" src="/js/main.js"></script>
</body>
</html>`;
}

function generateProjectPages(options = {}) {
  const previous = { publicDir, works, slugs, outputDir, sitemapPath };
  publicDir = options.publicDir || publicDir;
  works = options.works || works;
  slugs = options.slugs || slugs;
  outputDir = options.outputDir || path.join(publicDir, "pages", "works");
  sitemapPath = options.sitemapPath || path.join(publicDir, "sitemap.xml");
  try {
const indexableWorks = works.filter((work) => slugs[work.id]);
if (indexableWorks.length !== Object.keys(slugs).length) {
  throw new Error("Each stable project slug must reference an existing work");
}
if (new Set(Object.values(slugs)).size !== indexableWorks.length) {
  throw new Error("Project slugs must be unique");
}

fs.mkdirSync(outputDir, { recursive: true });
for (const work of indexableWorks) {
  fs.writeFileSync(path.join(outputDir, `${slugs[work.id]}.html`), renderPage(work, indexableWorks), "utf8");
}
for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html") && !indexableWorks.some((work) => `${slugs[work.id]}.html` === entry.name)) {
    fs.unlinkSync(path.join(outputDir, entry.name));
  }
}

const sitemap = fs.readFileSync(sitemapPath, "utf8");
const projectUrls = indexableWorks
  .map((work) => `  <url><loc>https://prokamen.by/works/${slugs[work.id]}/</loc></url>`)
  .join("\n");
const start = "  <!-- PROJECT_URLS_START -->";
const end = "  <!-- PROJECT_URLS_END -->";
if (!sitemap.includes(start) || !sitemap.includes(end)) {
  throw new Error("sitemap.xml must contain project URL markers");
}
const updatedSitemap = sitemap.replace(
  new RegExp(`${start}[\\s\\S]*?${end}`),
  `${start}\n${projectUrls}\n${end}`,
);
fs.writeFileSync(sitemapPath, updatedSitemap, "utf8");

  return { pages: indexableWorks.length, slugs: indexableWorks.map((work) => slugs[work.id]) };
  } finally {
    ({ publicDir, works, slugs, outputDir, sitemapPath } = previous);
  }
}

if (require.main === module) {
  const result = generateProjectPages();
  console.log(`Generated ${result.pages} static project pages.`);
}
module.exports = { generateProjectPages, escapeHtml };
