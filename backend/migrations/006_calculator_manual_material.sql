INSERT INTO materials
  (material_id, type_id, title, fabricator, description, sku, price_per_m2,
   slab_format_id, length_mm, width_mm, thickness_mm, price_unit,
   base_price_usd_cents, markup_bps, is_active, public_available, sort_order)
SELECT
  'custom', 'quartz', 'Свой камень', NULL,
  'Ручная позиция менеджера для материала вне каталога', 'CUSTOM', 0,
  f.format_id, f.length_mm, f.width_mm, f.thickness_mm, 'manual',
  0, 0, 1, 0, 9990
FROM calculator_slab_formats f
WHERE f.system_code = 'normal'
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  price_unit = 'manual',
  public_available = 0;
