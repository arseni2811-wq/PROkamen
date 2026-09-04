const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.resolve(__dirname, "..", "..", "public");
const read = (...parts) => fs.readFileSync(path.join(publicDir, ...parts), "utf8");

test("commercial landings link project cards and CTAs to a request form", () => {
  const landing = read("js", "landing.js");
  const contacts = read("pages", "contacts.html");

  assert.match(landing, /href="\/contacts\/#request"/);
  assert.match(landing, /href = `\/works\/\$\{slugs\[w\.id\]\}\/`/);
  assert.match(landing, /class="work-card__link" href="\$\{href\}"/);
  assert.match(contacts, /<section id="request"/);
  assert.match(contacts, /action="\/php\/send-mail\.php" method="post"/);
  for (const field of ["name", "phone", "email", "message"]) {
    assert.match(contacts, new RegExp(`name="${field}"`));
  }
  assert.match(contacts, /name="name"[^>]*required/);
  assert.match(contacts, /name="phone"[^>]*required/);
  assert.match(contacts, /name="message"[^>]*required/);
});

test("project cards and desktop products menu use their shared responsive rules", () => {
  const css = read("css", "components.css");
  const main = read("js", "main.js");

  assert.match(css, /\.work-card__media,[\s\S]*?aspect-ratio: 4 \/ 3/);
  assert.match(css, /\.work-card__media img,[\s\S]*?object-fit: cover/);
  assert.match(css, /\.work-card > \.work-card__link[\s\S]*?flex-direction: column/);
  assert.match(css, /width: clamp\(440px, 36vw, 500px\)/);
  assert.match(css, /\.nav__submenu-list:first-of-type[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(main, /const \[all, projectSlugs\] = await Promise\.all/);
  assert.match(main, /\/works\/\$\{projectSlugs\[work\.id\]\}\//);
});
