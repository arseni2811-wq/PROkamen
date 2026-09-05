const path = require("path");

const LEGACY_WORK_TYPES = {
  "w-001": "Подоконник", "w-002": "Столешница для ванной",
  "w-003": "Столешница для ванной", "w-004": "Подоконник",
  "w-005": "Каминная полка", "w-006": "Столешница для журнального столика",
  "w-007": "Столешница для обеденного столика", "w-008": "Столешница для уличной беседки",
  "w-009": "Столешница", "w-010": "Уличный комплекс",
  "w-011": "Столешница для ванной", "w-012": "Уличный комплекс",
  "w-013": "Столешницы", "w-014": "Ступенька входной группы и журнальный столик",
  "w-015": "Столешница для уличной кухни и фартук", "w-016": "Столешница для кухни",
};

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value) {
  return String(value || "").trim().toLowerCase().split("")
    .map((character) => CYRILLIC[character] ?? character).join("")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

function nullable(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeProjectInput(input) {
  return {
    title: input.title.trim(), slug: slugify(input.slug || input.title),
    description: input.description.trim(), short_description: nullable(input.short_description),
    location: nullable(input.location), work_type: input.work_type.trim(),
    work_details: nullable(input.work_details), work_category: nullable(input.work_category),
    material_category: nullable(input.material_category), material_id: nullable(input.material_id),
    material_name_snapshot: nullable(input.material_name_snapshot), published: input.published ? 1 : 0,
    public_sort_order: Number(input.public_sort_order || 0), seo_title: nullable(input.seo_title),
    seo_description: nullable(input.seo_description),
  };
}

function buildLegacyImportRecords(works, slugs) {
  const byId = new Map(works.map((work) => [work.id, work]));
  return Object.entries(slugs).map(([legacyId, slug], projectIndex) => {
    const work = byId.get(legacyId);
    if (!work) throw new Error(`Slug ${legacyId} has no source project`);
    return {
      legacy_id: legacyId, title: work.title.trim(), slug, description: work.desc.trim(),
      short_description: work.desc.trim().slice(0, 500), location: nullable(work.location),
      work_type: LEGACY_WORK_TYPES[legacyId] || "Другое",
      work_category: LEGACY_WORK_TYPES[legacyId] || "Другое",
      material_category: Array.isArray(work.material) ? work.material.join(",") : work.material,
      material_name_snapshot: work.materialRu, published: 1, public_sort_order: projectIndex,
      images: work.images.map((filePath, imageIndex) => ({
        file_path: filePath, original_name: path.basename(filePath),
        alt_text: `${work.title.trim()} — фото ${imageIndex + 1}`,
        sort_order: imageIndex, is_cover: imageIndex === 0 ? 1 : 0,
      })),
    };
  });
}

function normalizeCover(images) {
  if (!images.length) return [];
  const requested = images.findIndex((image) => Boolean(image.is_cover));
  const coverIndex = requested >= 0 ? requested : 0;
  return images.map((image, index) => ({ ...image, is_cover: index === coverIndex ? 1 : 0 }));
}

function toPublicProject(project) {
  const images = normalizeCover(project.images || []).sort(
    (left, right) => left.sort_order - right.sort_order || left.image_id - right.image_id,
  );
  return {
    id: project.legacy_id || `portfolio-${project.project_id}`, projectId: project.project_id,
    slug: project.slug, title: project.title, desc: project.description,
    shortDescription: project.short_description || project.description, location: project.location || "",
    workType: project.work_type, workDetails: project.work_details || "",
    workCategory: project.work_category || "", material: project.material_category || "other",
    materialCategory: project.material_category || "other", materialId: project.material_id || null,
    materialRu: project.material_name_snapshot || project.material_title || "Материал не указан",
    publicSortOrder: Number(project.public_sort_order || 0), seoTitle: project.seo_title || "",
    seoDescription: project.seo_description || "",
    images: images.map((image) => ({
      id: image.image_id, sourcePath: image.file_path, publicPath: image.public_path || image.file_path,
      alt: image.alt_text || `${project.title} — проект ПРО Камень`, isCover: Boolean(image.is_cover),
      sortOrder: Number(image.sort_order || 0),
    })),
  };
}

module.exports = { LEGACY_WORK_TYPES, slugify, normalizeProjectInput, buildLegacyImportRecords, normalizeCover, toPublicProject };
