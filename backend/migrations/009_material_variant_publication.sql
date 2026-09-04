ALTER TABLE material_variants
  ADD COLUMN public_available TINYINT(1) NOT NULL DEFAULT 0 AFTER is_calculator_ready,
  ADD COLUMN public_sort_order INT NOT NULL DEFAULT 0 AFTER public_available,
  ADD KEY idx_material_variants_public (material_id, public_available, is_active, public_sort_order);
