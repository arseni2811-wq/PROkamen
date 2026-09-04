const test = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = process.env.JWT_SECRET || "portfolio-test-secret";
const fakePool = { end: async () => undefined };
require.cache[require.resolve("../db")] = { id: require.resolve("../db"), filename: require.resolve("../db"), loaded: true, exports: fakePool };
const { importPortfolio } = require("../scripts/import-portfolio");

test("portfolio import is transactional and idempotent", async () => {
  const projects = []; const images = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {},
    async query(sql, params) {
      if (sql.includes("SELECT project_id, slug")) {
        const found = projects.find((project) => project.legacy_id === params[0] || project.slug === params[1]);
        return [found ? [{ project_id: found.project_id, slug: found.slug }] : []];
      }
      if (sql.includes("INSERT INTO portfolio_projects")) {
        const project_id = projects.length + 1;
        projects.push({ project_id, legacy_id: params[0], slug: params[2] }); return [{ insertId: project_id }];
      }
      if (sql.includes("INSERT INTO portfolio_project_images")) { images.push({ project_id: params[0], file_path: params[1] }); return [{ insertId: images.length }]; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const first = await importPortfolio(connection); const second = await importPortfolio(connection);
  assert.equal(first.source, 16); assert.equal(first.inserted, 16); assert.ok(images.length > 16);
  assert.equal(second.inserted, 0); assert.equal(second.skipped, 16); assert.equal(projects.length, 16);
});
