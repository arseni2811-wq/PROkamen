const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..", "..");
const publicDir = path.join(projectRoot, "public");
const slugs = JSON.parse(
  fs.readFileSync(
    path.join(publicDir, "assets", "data", "project-slugs.json"),
    "utf8",
  ),
);

test("static SEO project pages have required content and assets", () => {
  const seenTitles = new Set();
  const seenCanonicals = new Set();

  for (const slug of Object.values(slugs)) {
    const file = path.join(publicDir, "pages", "works", `${slug}.html`);
    const html = fs.readFileSync(file, "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    const h1 = html.match(/<h1\b[^>]*>([^<]+)<\/h1>/i)?.[1];
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];

    assert.ok(title, `${slug}: title is required`);
    assert.ok(h1, `${slug}: H1 is required`);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${slug}: one H1`);
    assert.equal((html.match(/<title>/gi) || []).length, 1, `${slug}: one title`);
    assert.equal(
      canonical,
      `https://prokamen.by/works/${slug}/`,
      `${slug}: canonical must be a clean URL`,
    );
    assert.ok(html.includes('href="/works/"'), `${slug}: link to works index`);
    assert.ok(
      /href="\/(?:stoleshnicy|podokonniki)\//.test(html),
      `${slug}: link to a commercial landing is required`,
    );
    const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    assert.ok(images.length > 0, `${slug}: at least one project image is required`);
    for (const image of images) {
      assert.match(image, /\balt="[^"]+"/i, `${slug}: image alt is required`);
      assert.match(image, /\bwidth="\d+"/i, `${slug}: image width is required`);
      assert.match(image, /\bheight="\d+"/i, `${slug}: image height is required`);
    }
    assert.ok(ogImage, `${slug}: og:image is required`);
    assert.ok(
      fs.existsSync(path.join(publicDir, new URL(ogImage).pathname)),
      `${slug}: og:image must exist`,
    );
    assert.doesNotThrow(() => JSON.parse(jsonLd), `${slug}: JSON-LD must be valid JSON`);
    assert.ok(!seenTitles.has(title), `${slug}: duplicate title`);
    assert.ok(!seenCanonicals.has(canonical), `${slug}: duplicate canonical`);
    seenTitles.add(title);
    seenCanonicals.add(canonical);
  }
});

test("project routes serve a valid case and return 404 for an unknown slug", async (t) => {
  const { app } = require("../server");
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  t.after(() => server.close());

  const { port } = server.address();
  const existingSlug = Object.values(slugs)[0];
  const existing = await fetch(`http://127.0.0.1:${port}/works/${existingSlug}/`);
  const missing = await fetch(
    `http://127.0.0.1:${port}/works/nonexistent-test-project/`,
  );

  assert.equal(existing.status, 200);
  assert.equal(missing.status, 404);
});
