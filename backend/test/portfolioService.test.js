const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { portfolioProjectSchema, portfolioImageOrderSchema } = require("../middleware/portfolioSchemas");
const { slugify, buildLegacyImportRecords, normalizeCover, toPublicProject } = require("../services/portfolioService");
const { filterPublishable, buildArtifacts, safeUploadedSource } = require("../scripts/export-portfolio");
const { generateProjectPages } = require("../scripts/generate-project-pages");

const publicDir = path.resolve(__dirname, "..", "..", "public");
const works = JSON.parse(fs.readFileSync(path.join(publicDir, "assets/data/works.json"), "utf8"));
const slugs = JSON.parse(fs.readFileSync(path.join(publicDir, "assets/data/project-slugs.json"), "utf8"));

test("legacy import is limited to the 16 stable SEO slugs", () => {
  const records = buildLegacyImportRecords(works, slugs);
  assert.equal(records.length, 16);
  assert.deepEqual(records.map((record) => record.slug), Object.values(slugs));
  assert.equal(new Set(records.map((record) => record.legacy_id)).size, 16);
  assert.ok(records.every((record) => record.images[0].is_cover === 1));
});

test("portfolio validation and slug generation reject unsafe input", () => {
  assert.equal(slugify("Столешница Q757 — Москва"), "stoleshnica-q757-moskva");
  assert.equal(portfolioProjectSchema.safeParse({ title: "x", slug: "../bad", description: "short", work_type: "x" }).success, false);
  assert.equal(portfolioProjectSchema.safeParse({
    title: "Столешница для кухни", slug: "stoleshnica-dlya-kuhni", description: "Достаточно подробное описание",
    work_type: "Столешница", published: false, public_sort_order: 1,
  }).success, true);
});

test("image metadata requires one cover and normalizes duplicate cover flags", () => {
  const normalized = normalizeCover([{ image_id: 1, is_cover: 1 }, { image_id: 2, is_cover: 1 }]);
  assert.deepEqual(normalized.map((image) => image.is_cover), [1, 0]);
  assert.equal(portfolioImageOrderSchema.safeParse({ images: [
    { image_id: 1, sort_order: 0, is_cover: true, alt_text: "Обложка" },
    { image_id: 2, sort_order: 1, is_cover: false, alt_text: null },
  ] }).success, true);
});

test("public export excludes drafts and archived projects and retains material relation", () => {
  const base = { project_id: 7, legacy_id: null, slug: "test-project", title: "Test", description: "Description",
    work_type: "Столешница", material_id: "material-1", material_title: "Stone", material_name_snapshot: "Brand — Stone",
    material_category: "quartz", published: 1, archived_at: null, images: [{ image_id: 2, file_path: "/image.jpg", public_path: "/image.jpg", sort_order: 0, is_cover: 1 }] };
  const filtered = filterPublishable([base, { ...base, project_id: 8, published: 0 }, { ...base, project_id: 9, archived_at: new Date() }]);
  assert.equal(filtered.length, 1);
  const project = toPublicProject(filtered[0]);
  const artifacts = buildArtifacts([project]);
  assert.equal(artifacts.slugs["portfolio-7"], "test-project");
  assert.equal(artifacts.works[0].materialId, "material-1");
  assert.equal(artifacts.works[0].images[0], "/image.jpg");
  assert.match(safeUploadedSource({ projectId: 7 }, { sourcePath: "uploads/portfolio/7/image.jpg" }), /portfolio[\\/]7[\\/]image\.jpg$/);
  assert.throws(() => safeUploadedSource({ projectId: 7 }, { sourcePath: "uploads/portfolio/8/image.jpg" }), /Unsafe/);
});

test("generator creates escaped HTML and published sitemap entries", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "prokamen-portfolio-generator-"));
  try {
    fs.mkdirSync(path.join(temp, "assets/images"), { recursive: true });
    fs.mkdirSync(path.join(temp, "pages/works"), { recursive: true });
    fs.copyFileSync(path.join(publicDir, "assets/images/works/w-2025-001/1.jpg"), path.join(temp, "assets/images/test.jpg"));
    fs.writeFileSync(path.join(temp, "sitemap.xml"), "<urlset>\n  <!-- PROJECT_URLS_START -->\n  <!-- PROJECT_URLS_END -->\n</urlset>\n");
    fs.writeFileSync(path.join(temp, "pages/works/stale.html"), "stale");
    const result = generateProjectPages({ publicDir: temp, works: [{ id: "safe", title: "<script>alert(1)</script>",
      location: "Минск", desc: "Описание <b>без HTML</b>", material: "quartz", materialRu: "кварц",
      workType: "Столешница", images: ["/assets/images/test.jpg"] }], slugs: { safe: "safe-project" } });
    assert.equal(result.pages, 1);
    const html = fs.readFileSync(path.join(temp, "pages/works/safe-project.html"), "utf8");
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.equal(fs.existsSync(path.join(temp, "pages/works/stale.html")), false);
    assert.match(fs.readFileSync(path.join(temp, "sitemap.xml"), "utf8"), /\/works\/safe-project\//);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
