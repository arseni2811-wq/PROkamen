const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { buildLegacyImportRecords } = require("../services/portfolioService");

const publicData = path.resolve(__dirname, "..", "..", "public", "assets", "data");

async function importPortfolio(executor = pool) {
  const works = JSON.parse(fs.readFileSync(path.join(publicData, "works.json"), "utf8"));
  const slugs = JSON.parse(fs.readFileSync(path.join(publicData, "project-slugs.json"), "utf8"));
  const records = buildLegacyImportRecords(works, slugs);
  const connection = typeof executor.getConnection === "function" ? await executor.getConnection() : executor;
  let ownsConnection = connection !== executor;
  let inserted = 0;
  try {
    await connection.beginTransaction();
    for (const project of records) {
      const [existing] = await connection.query(
        "SELECT project_id, slug FROM portfolio_projects WHERE legacy_id=? OR slug=? FOR UPDATE",
        [project.legacy_id, project.slug],
      );
      if (existing[0]) {
        if (existing[0].slug !== project.slug) {
          throw new Error(`Legacy project ${project.legacy_id} conflicts with slug ${existing[0].slug}`);
        }
        continue;
      }
      const [result] = await connection.query(
        `INSERT INTO portfolio_projects
         (legacy_id, title, slug, description, short_description, location, work_type, work_category,
          material_category, material_name_snapshot, published, public_sort_order, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
        [project.legacy_id, project.title, project.slug, project.description, project.short_description,
          project.location, project.work_type, project.work_category, project.material_category,
          project.material_name_snapshot, project.public_sort_order],
      );
      for (const image of project.images) {
        await connection.query(
          `INSERT INTO portfolio_project_images
           (project_id, file_path, original_name, alt_text, sort_order, is_cover)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [result.insertId, image.file_path, image.original_name, image.alt_text, image.sort_order, image.is_cover],
        );
      }
      inserted += 1;
    }
    await connection.commit();
    return { source: records.length, inserted, skipped: records.length - inserted, slugs: records.map((item) => item.slug) };
  } catch (error) {
    await connection.rollback(); throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

if (require.main === module) {
  importPortfolio().then((result) => console.log(JSON.stringify({ success: true, ...result }, null, 2)))
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = { importPortfolio };
