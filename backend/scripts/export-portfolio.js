const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const pool = require("../db");
const { hydrateProjects } = require("../controllers/portfolioController");
const { toPublicProject } = require("../services/portfolioService");

const projectRoot = path.resolve(__dirname, "..", "..");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(publicDir, "assets", "data");
const uploadRoot = process.env.UPLOADS_DIR || path.join(projectRoot, "backend", "uploads");

function filterPublishable(projects) {
  return projects.filter((project) => Boolean(project.published) && !project.archived_at);
}

function buildArtifacts(projects) {
  const slugs = Object.fromEntries(projects.map((project) => [project.id, project.slug]));
  const works = projects.map((project) => ({
    id: project.id, material: project.material.includes(",") ? project.material.split(",") : project.material,
    materialRu: project.materialRu, title: project.title, location: project.location, desc: project.desc,
    workType: project.workType, workCategory: project.workCategory, materialId: project.materialId,
    seoTitle: project.seoTitle, seoDescription: project.seoDescription,
    images: project.images.map((image) => image.publicPath),
    imageAlts: project.images.map((image) => image.alt),
  }));
  return { slugs, works };
}

function safeUploadedSource(project, image) {
  const expectedPrefix = path.posix.join("uploads", "portfolio", String(project.projectId)) + "/";
  if (!String(image.sourcePath).startsWith(expectedPrefix)) throw new Error("Unsafe portfolio upload path");
  return path.join(uploadRoot, "portfolio", String(project.projectId), path.basename(image.sourcePath));
}

function publishImages(project) {
  return project.images.map((image) => {
    if (String(image.sourcePath).startsWith("/")) return image;
    const extension = path.extname(image.sourcePath).toLowerCase();
    const publicPath = `/assets/images/works/portfolio-${project.projectId}/${image.id}${extension}`;
    const destination = path.join(publicDir, publicPath.replace(/^\/+/, ""));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(safeUploadedSource(project, image), destination);
    return { ...image, publicPath };
  });
}

async function exportPortfolio(executor = pool) {
  const [rows] = await executor.query(
    `SELECT p.*, m.title AS material_title FROM portfolio_projects p
     LEFT JOIN materials m ON m.material_id=p.material_id
     WHERE p.published=1 AND p.archived_at IS NULL ORDER BY p.public_sort_order, p.project_id`,
  );
  const projects = filterPublishable(await hydrateProjects(executor, rows)).map(toPublicProject)
    .map((project) => ({ ...project, images: publishImages(project) }));
  if (projects.some((project) => project.images.length === 0)) {
    throw new Error("Published portfolio projects must have at least one image");
  }
  const { slugs, works } = buildArtifacts(projects);
  fs.writeFileSync(path.join(dataDir, "portfolio-public.json"), `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(dataDir, "works.json"), `${JSON.stringify(works, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(dataDir, "project-slugs.json"), `${JSON.stringify(slugs, null, 2)}\n`, "utf8");
  const generation = spawnSync(process.execPath, [path.join(__dirname, "generate-project-pages.js")], {
    cwd: projectRoot, encoding: "utf8",
  });
  if (generation.status !== 0) throw new Error(generation.stderr || "Static page generation failed");
  return { exported: projects.length, generator: generation.stdout.trim() };
}

if (require.main === module) {
  exportPortfolio().then((result) => console.log(JSON.stringify({ success: true, ...result }, null, 2)))
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = { exportPortfolio, safeUploadedSource, filterPublishable, buildArtifacts };
