const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { normalizeProjectInput } = require("../services/portfolioService");
const { removeUploaded } = require("../middleware/portfolioUpload");

const PROJECT_COLUMNS = `p.*, m.title AS material_title, m.fabricator AS material_fabricator,
  m.type_id AS linked_material_category`;

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function imageUrl(projectId, image) {
  return String(image.file_path).startsWith("/")
    ? image.file_path
    : `/api/admin/portfolio/${projectId}/images/${image.image_id}/file`;
}

async function hydrateProjects(executor, projects) {
  if (!projects.length) return [];
  const ids = projects.map((project) => project.project_id);
  const [images] = await executor.query(
    `SELECT image_id, project_id, file_path, original_name, alt_text, sort_order, is_cover, created_at
     FROM portfolio_project_images WHERE project_id IN (?) ORDER BY sort_order, image_id`, [ids],
  );
  const grouped = new Map(ids.map((id) => [Number(id), []]));
  for (const image of images) {
    image.url = imageUrl(image.project_id, image);
    grouped.get(Number(image.project_id))?.push(image);
  }
  return projects.map((project) => ({
    ...project, published: Boolean(project.published), archived: Boolean(project.archived_at),
    images: grouped.get(Number(project.project_id)) || [],
  }));
}

async function findProject(executor, projectId, includeArchived = false) {
  const [rows] = await executor.query(
    `SELECT ${PROJECT_COLUMNS} FROM portfolio_projects p
     LEFT JOIN materials m ON m.material_id = p.material_id
     WHERE p.project_id = ? ${includeArchived ? "" : "AND p.archived_at IS NULL"}`, [projectId],
  );
  return (await hydrateProjects(executor, rows))[0] || null;
}

async function resolveMaterial(executor, input) {
  if (!input.material_id) return input;
  const [rows] = await executor.query(
    "SELECT material_id, type_id, title, fabricator FROM materials WHERE material_id = ?", [input.material_id],
  );
  if (!rows[0]) {
    const error = new Error("Выбранный материал не найден"); error.status = 400; throw error;
  }
  const material = rows[0];
  return {
    ...input,
    material_category: input.material_category || material.type_id || null,
    material_name_snapshot: input.material_name_snapshot ||
      [material.fabricator, material.title].filter(Boolean).join(" — "),
  };
}

function sendError(res, error, context) {
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ success: false, message: "Работа с таким slug уже существует" });
  }
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  console.error(context, error);
  return res.status(500).json({ success: false, message: "Операция с портфолио не выполнена" });
}

async function listProjects(req, res) {
  try {
    const includeArchived = req.query.archived === "1";
    const [rows] = await pool.query(
      `SELECT ${PROJECT_COLUMNS} FROM portfolio_projects p
       LEFT JOIN materials m ON m.material_id = p.material_id
       ${includeArchived ? "" : "WHERE p.archived_at IS NULL"}
       ORDER BY p.public_sort_order, p.updated_at DESC`,
    );
    res.json({ success: true, projects: await hydrateProjects(pool, rows) });
  } catch (error) { sendError(res, error, "Ошибка получения портфолио:"); }
}

async function getProject(req, res) {
  const projectId = validId(req.params.id);
  if (!projectId) return res.status(400).json({ success: false, message: "Некорректный ID работы" });
  try {
    const project = await findProject(pool, projectId, true);
    if (!project) return res.status(404).json({ success: false, message: "Работа не найдена" });
    res.json({ success: true, project });
  } catch (error) { sendError(res, error, "Ошибка получения работы:"); }
}

async function createProject(req, res) {
  let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    let data = normalizeProjectInput(req.validatedBody);
    if (!data.slug) { const error = new Error("Не удалось сформировать slug"); error.status = 400; throw error; }
    data = await resolveMaterial(connection, data);
    if (data.published) {
      const error = new Error("Сначала сохраните черновик и загрузите хотя бы одну фотографию"); error.status = 400; throw error;
    }
    const [result] = await connection.query(
      `INSERT INTO portfolio_projects
       (title, slug, description, short_description, location, work_type, work_details,
        work_category, material_category, material_id, material_name_snapshot, published,
        public_sort_order, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.title, data.slug, data.description, data.short_description, data.location,
        data.work_type, data.work_details, data.work_category, data.material_category,
        data.material_id, data.material_name_snapshot, data.published, data.public_sort_order,
        data.seo_title, data.seo_description],
    );
    await connection.commit();
    res.status(201).json({ success: true, message: "Работа сохранена", project: await findProject(pool, result.insertId) });
  } catch (error) { if (connection) await connection.rollback(); sendError(res, error, "Ошибка создания работы:"); }
  finally { if (connection) connection.release(); }
}

async function updateProject(req, res) {
  const projectId = validId(req.params.id);
  if (!projectId) return res.status(400).json({ success: false, message: "Некорректный ID работы" });
  let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    const existing = await findProject(connection, projectId);
    if (!existing) { const error = new Error("Работа не найдена"); error.status = 404; throw error; }
    let data = await resolveMaterial(connection, normalizeProjectInput(req.validatedBody));
    if (data.published && existing.images.length === 0) {
      const error = new Error("Для публикации нужна хотя бы одна фотография"); error.status = 400; throw error;
    }
    await connection.query(
      `UPDATE portfolio_projects SET title=?, slug=?, description=?, short_description=?, location=?,
       work_type=?, work_details=?, work_category=?, material_category=?, material_id=?,
       material_name_snapshot=?, published=?, public_sort_order=?, seo_title=?, seo_description=?,
       published_at=CASE WHEN ? = 1 AND published_at IS NULL THEN NOW() WHEN ? = 0 THEN NULL ELSE published_at END
       WHERE project_id=? AND archived_at IS NULL`,
      [data.title, data.slug, data.description, data.short_description, data.location, data.work_type,
        data.work_details, data.work_category, data.material_category, data.material_id,
        data.material_name_snapshot, data.published, data.public_sort_order, data.seo_title,
        data.seo_description, data.published, data.published, projectId],
    );
    await connection.commit();
    res.json({ success: true, message: "Работа сохранена", project: await findProject(pool, projectId) });
  } catch (error) { if (connection) await connection.rollback(); sendError(res, error, "Ошибка изменения работы:"); }
  finally { if (connection) connection.release(); }
}

async function archiveProject(req, res) {
  const projectId = validId(req.params.id);
  if (!projectId) return res.status(400).json({ success: false, message: "Некорректный ID работы" });
  try {
    const [result] = await pool.query(
      "UPDATE portfolio_projects SET published=0, published_at=NULL, archived_at=NOW() WHERE project_id=? AND archived_at IS NULL",
      [projectId],
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Работа не найдена" });
    res.json({ success: true, message: "Работа перемещена в архив" });
  } catch (error) { sendError(res, error, "Ошибка архивации работы:"); }
}

async function uploadImages(req, res) {
  const projectId = validId(req.params.id);
  if (!projectId || !req.files?.length) {
    await removeUploaded(req.files);
    return res.status(400).json({ success: false, message: "Фотографии не переданы" });
  }
  let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    const [lockedProjects] = await connection.query(
      "SELECT project_id FROM portfolio_projects WHERE project_id=? AND archived_at IS NULL FOR UPDATE", [projectId],
    );
    if (!lockedProjects[0]) { const error = new Error("Работа не найдена"); error.status = 404; throw error; }
    const [sortRows] = await connection.query(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_sort, COUNT(*) AS image_count FROM portfolio_project_images WHERE project_id=?", [projectId],
    );
    const inserted = [];
    for (const [index, file] of req.files.entries()) {
      const relativePath = path.posix.join("uploads", "portfolio", String(projectId), file.filename);
      const [result] = await connection.query(
        `INSERT INTO portfolio_project_images (project_id, file_path, original_name, alt_text, sort_order, is_cover)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, relativePath, file.originalname, null, Number(sortRows[0].max_sort) + index + 1,
          Number(sortRows[0].image_count) === 0 && index === 0 ? 1 : 0],
      );
      inserted.push(result.insertId);
    }
    await connection.commit();
    res.status(201).json({ success: true, message: `Загружено фотографий: ${inserted.length}`,
      project: await findProject(pool, projectId) });
  } catch (error) {
    if (connection) await connection.rollback(); await removeUploaded(req.files);
    sendError(res, error, "Ошибка загрузки фотографий:");
  } finally { if (connection) connection.release(); }
}

async function saveImageOrder(req, res) {
  const projectId = validId(req.params.id);
  if (!projectId) return res.status(400).json({ success: false, message: "Некорректный ID работы" });
  const images = req.validatedBody.images;
  if (images.filter((image) => image.is_cover).length !== 1) {
    return res.status(400).json({ success: false, message: "Выберите ровно одну обложку" });
  }
  let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    const [owned] = await connection.query(
      "SELECT image_id FROM portfolio_project_images WHERE project_id=? FOR UPDATE", [projectId],
    );
    const ownedIds = new Set(owned.map((image) => Number(image.image_id)));
    if (owned.length !== images.length || images.some((image) => !ownedIds.has(image.image_id))) {
      const error = new Error("Список фотографий не принадлежит этой работе"); error.status = 400; throw error;
    }
    await connection.query("UPDATE portfolio_project_images SET is_cover=0 WHERE project_id=?", [projectId]);
    for (const image of images) {
      await connection.query(
        "UPDATE portfolio_project_images SET sort_order=?, is_cover=?, alt_text=? WHERE image_id=? AND project_id=?",
        [image.sort_order, image.is_cover ? 1 : 0, image.alt_text || null, image.image_id, projectId],
      );
    }
    await connection.commit();
    res.json({ success: true, message: "Фотографии сохранены", project: await findProject(pool, projectId) });
  } catch (error) { if (connection) await connection.rollback(); sendError(res, error, "Ошибка порядка фотографий:"); }
  finally { if (connection) connection.release(); }
}

async function deleteImage(req, res) {
  const projectId = validId(req.params.id); const imageId = validId(req.params.imageId);
  if (!projectId || !imageId) return res.status(400).json({ success: false, message: "Некорректный ID фотографии" });
  let connection; let deleted;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM portfolio_project_images WHERE image_id=? AND project_id=? FOR UPDATE", [imageId, projectId],
    );
    deleted = rows[0];
    if (!deleted) { const error = new Error("Фотография не найдена"); error.status = 404; throw error; }
    await connection.query("DELETE FROM portfolio_project_images WHERE image_id=? AND project_id=?", [imageId, projectId]);
    if (deleted.is_cover) {
      const [nextRows] = await connection.query(
        "SELECT image_id FROM portfolio_project_images WHERE project_id=? ORDER BY sort_order, image_id LIMIT 1", [projectId],
      );
      if (nextRows[0]) await connection.query("UPDATE portfolio_project_images SET is_cover=1 WHERE image_id=?", [nextRows[0].image_id]);
    }
    await connection.query("UPDATE portfolio_projects SET published=0, published_at=NULL WHERE project_id=? AND NOT EXISTS (SELECT 1 FROM portfolio_project_images WHERE project_id=?)", [projectId, projectId]);
    await connection.commit();
    if (!String(deleted.file_path).startsWith("/")) {
      const uploadRoot = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
      const absolute = path.join(uploadRoot, "portfolio", String(projectId), path.basename(deleted.file_path));
      await fs.promises.unlink(absolute).catch(() => undefined);
    }
    res.json({ success: true, message: "Фотография удалена", project: await findProject(pool, projectId) });
  } catch (error) { if (connection) await connection.rollback(); sendError(res, error, "Ошибка удаления фотографии:"); }
  finally { if (connection) connection.release(); }
}

async function serveImage(req, res) {
  const projectId = validId(req.params.id); const imageId = validId(req.params.imageId);
  if (!projectId || !imageId) return res.status(400).json({ success: false, message: "Некорректный ID фотографии" });
  try {
    const [rows] = await pool.query("SELECT file_path FROM portfolio_project_images WHERE image_id=? AND project_id=?", [imageId, projectId]);
    if (!rows[0]) return res.status(404).json({ success: false, message: "Фотография не найдена" });
    const stored = String(rows[0].file_path);
    let absolute;
    if (stored.startsWith("/")) {
      if (!stored.startsWith("/assets/images/works/")) {
        return res.status(400).json({ success: false, message: "Некорректный путь фотографии" });
      }
      const root = path.resolve(__dirname, "..", "..", "public", "assets", "images", "works");
      absolute = path.resolve(root, stored.slice("/assets/images/works/".length));
      if (!absolute.startsWith(`${root}${path.sep}`)) {
        return res.status(400).json({ success: false, message: "Некорректный путь фотографии" });
      }
    } else {
      const expected = path.posix.join("uploads", "portfolio", String(projectId)) + "/";
      if (!stored.startsWith(expected)) {
        return res.status(400).json({ success: false, message: "Некорректный путь фотографии" });
      }
      absolute = path.join(process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads"), "portfolio", String(projectId), path.basename(stored));
    }
    return res.sendFile(absolute, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ success: false, message: "Файл фотографии не найден" });
    });
  } catch (error) { sendError(res, error, "Ошибка выдачи фотографии:"); }
}

module.exports = { listProjects, getProject, createProject, updateProject, archiveProject,
  uploadImages, saveImageOrder, deleteImage, serveImage, validId, hydrateProjects, findProject };
