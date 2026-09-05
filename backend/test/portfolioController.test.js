const test = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = process.env.JWT_SECRET || "portfolio-controller-secret";
const state = { projects: [], images: [], materials: [{ material_id: "stone-1", type_id: "quartz", title: "Calacatta", fabricator: "Avarus" }] };
const connection = {
  async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
  async query(sql, params = []) {
    if (sql.includes("SELECT material_id, type_id, title, fabricator FROM materials")) return [[state.materials.find((item) => item.material_id === params[0])].filter(Boolean)];
    if (sql.includes("INSERT INTO portfolio_projects")) {
      if (state.projects.some((item) => item.slug === params[1])) { const error = new Error("duplicate"); error.code = "ER_DUP_ENTRY"; throw error; }
      const project = { project_id: state.projects.length + 1, title: params[0], slug: params[1], description: params[2], short_description: params[3], location: params[4], work_type: params[5], work_details: params[6], work_category: params[7], material_category: params[8], material_id: params[9], material_name_snapshot: params[10], published: params[11], public_sort_order: params[12], seo_title: params[13], seo_description: params[14], archived_at: null };
      state.projects.push(project); return [{ insertId: project.project_id }];
    }
    if (sql.includes("UPDATE portfolio_projects SET title=")) {
      const project = state.projects.find((item) => item.project_id === params[17]);
      Object.assign(project, { title: params[0], slug: params[1], description: params[2], short_description: params[3], location: params[4], work_type: params[5], work_details: params[6], work_category: params[7], material_category: params[8], material_id: params[9], material_name_snapshot: params[10], published: params[11], public_sort_order: params[12], seo_title: params[13], seo_description: params[14] });
      return [{ affectedRows: project ? 1 : 0 }];
    }
    if (sql.includes("SELECT p.*,")) {
      const project = state.projects.find((item) => item.project_id === Number(params[0]));
      return [[project ? { ...project, material_title: state.materials.find((item) => item.material_id === project.material_id)?.title || null } : null].filter(Boolean)];
    }
    if (sql.includes("FROM portfolio_project_images WHERE project_id IN")) return [state.images.filter((image) => params[0].map(Number).includes(image.project_id))];
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
const fakePool = { getConnection: async () => connection, query: (...args) => connection.query(...args) };
require.cache[require.resolve("../db")] = { id: require.resolve("../db"), filename: require.resolve("../db"), loaded: true, exports: fakePool };
const controller = require("../controllers/portfolioController");
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function input(overrides = {}) { return { title: "Столешница Calacatta", slug: "stoleshnica-calacatta", description: "Подробное описание готовой работы", short_description: null, location: "Минск", work_type: "Столешница", work_details: null, work_category: "Столешница для кухни", material_category: null, material_id: "stone-1", material_name_snapshot: null, published: false, public_sort_order: 5, seo_title: null, seo_description: null, ...overrides }; }

test("create and update preserve material snapshot and publication state", async () => {
  state.projects.length = 0; state.images.length = 0;
  const created = response(); await controller.createProject({ validatedBody: input() }, created);
  assert.equal(created.statusCode, 201); assert.equal(created.body.project.material_id, "stone-1");
  assert.equal(created.body.project.material_name_snapshot, "Avarus — Calacatta");
  state.images.push({ image_id: 1, project_id: 1, file_path: "/assets/images/works/w-2025-001/1.jpg", sort_order: 0, is_cover: 1 });
  const updated = response(); await controller.updateProject({ params: { id: "1" }, validatedBody: input({ title: "Обновлённая столешница", published: true }) }, updated);
  assert.equal(updated.statusCode, 200); assert.equal(updated.body.project.title, "Обновлённая столешница"); assert.equal(updated.body.project.published, true);
});

test("duplicate slug returns conflict and publishing without an image is rejected", async () => {
  const duplicate = response(); await controller.createProject({ validatedBody: input() }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  state.images.length = 0;
  const publishing = response(); await controller.updateProject({ params: { id: "1" }, validatedBody: input({ published: true }) }, publishing);
  assert.equal(publishing.statusCode, 400); assert.match(publishing.body.message, /фотограф/i);
});
