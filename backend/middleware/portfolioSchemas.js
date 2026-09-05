const { z } = require("zod");
const nullableText = (max) => z.string().trim().max(max).optional().nullable();
const portfolioProjectSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional().or(z.literal("")),
  description: z.string().trim().min(10).max(20000), short_description: nullableText(500),
  location: nullableText(255), work_type: z.string().trim().min(2).max(120),
  work_details: nullableText(500), work_category: nullableText(80), material_category: nullableText(80),
  material_id: nullableText(50), material_name_snapshot: nullableText(255),
  published: z.boolean().default(false), public_sort_order: z.coerce.number().int().min(-100000).max(100000).default(0),
  seo_title: nullableText(180), seo_description: nullableText(320),
}).strict();
const portfolioImageSchema = z.object({
  alt_text: nullableText(255), sort_order: z.coerce.number().int().min(-100000).max(100000), is_cover: z.boolean(),
}).strict();
const portfolioImageOrderSchema = z.object({
  images: z.array(z.object({
    image_id: z.coerce.number().int().positive(), sort_order: z.coerce.number().int().min(-100000).max(100000),
    is_cover: z.boolean(), alt_text: nullableText(255),
  }).strict()).min(1).max(100),
}).strict();
module.exports = { portfolioProjectSchema, portfolioImageSchema, portfolioImageOrderSchema };
