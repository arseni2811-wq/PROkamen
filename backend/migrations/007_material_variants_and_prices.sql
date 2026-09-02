ALTER TABLE materials
  ADD COLUMN article VARCHAR(100) NULL AFTER sku,
  ADD COLUMN import_key CHAR(64) NULL AFTER article,
  ADD COLUMN is_discontinued TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD UNIQUE KEY uq_materials_import_key (import_key);

CREATE TABLE material_variants (
  material_variant_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id VARCHAR(50) NOT NULL,
  slab_format_id INT UNSIGNED NULL,
  variant_key CHAR(64) NOT NULL,
  commercial_format VARCHAR(80) NULL,
  source_name VARCHAR(160) NOT NULL,
  length_mm INT UNSIGNED NULL,
  width_mm INT UNSIGNED NULL,
  thickness_mm INT UNSIGNED NULL,
  surface VARCHAR(100) NULL,
  source_note TEXT NULL,
  is_discontinued TINYINT(1) NOT NULL DEFAULT 0,
  is_calculator_ready TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (material_variant_id),
  UNIQUE KEY uq_material_variants_key (variant_key),
  KEY idx_material_variants_material (material_id, is_active),
  KEY idx_material_variants_format (slab_format_id),
  CONSTRAINT fk_material_variants_material
    FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_material_variants_format
    FOREIGN KEY (slab_format_id) REFERENCES calculator_slab_formats(format_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_prices (
  material_price_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_variant_id BIGINT UNSIGNED NOT NULL,
  pricebook_id BIGINT UNSIGNED NULL,
  source_fingerprint CHAR(64) NOT NULL,
  quantity_fraction DECIMAL(4,2) NOT NULL,
  source_amount_minor BIGINT UNSIGNED NOT NULL,
  source_currency CHAR(3) NOT NULL,
  calculator_amount_usd_cents BIGINT UNSIGNED NULL,
  import_exchange_rate DECIMAL(18,8) NULL COMMENT 'Source currency units per USD',
  exchange_rate_date DATE NULL,
  unit VARCHAR(40) NULL,
  price_type VARCHAR(100) NULL,
  vat_info VARCHAR(100) NULL,
  source_file VARCHAR(255) NOT NULL,
  source_location VARCHAR(500) NULL,
  is_calculator_price TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_to TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (material_price_id),
  UNIQUE KEY uq_material_prices_source (source_fingerprint),
  KEY idx_material_prices_variant (material_variant_id, is_active),
  KEY idx_material_prices_calculator (material_variant_id, is_calculator_price, quantity_fraction, is_active),
  KEY idx_material_prices_pricebook (pricebook_id),
  CONSTRAINT chk_material_prices_fraction CHECK (quantity_fraction IN (1.00, 0.50, 0.25)),
  CONSTRAINT chk_material_prices_currency CHECK (source_currency IN ('USD', 'EUR')),
  CONSTRAINT fk_material_prices_variant
    FOREIGN KEY (material_variant_id) REFERENCES material_variants(material_variant_id) ON DELETE CASCADE,
  CONSTRAINT fk_material_prices_pricebook
    FOREIGN KEY (pricebook_id) REFERENCES calculator_pricebooks(pricebook_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
