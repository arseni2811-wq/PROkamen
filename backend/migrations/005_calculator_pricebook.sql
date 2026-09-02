ALTER TABLE dict_material_types
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN public_available TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 100;

INSERT INTO dict_material_types
  (type_id, type_name_ru, is_active, public_available, sort_order)
VALUES
  ('granite', 'Гранит', 1, 1, 20),
  ('onyx', 'Оникс', 1, 1, 30),
  ('marble', 'Мрамор', 1, 0, 40)
ON DUPLICATE KEY UPDATE
  type_name_ru = VALUES(type_name_ru),
  is_active = VALUES(is_active),
  public_available = VALUES(public_available),
  sort_order = VALUES(sort_order);

UPDATE dict_material_types
SET is_active = 0, public_available = 0, sort_order = 90
WHERE type_id = 'acrylic';
UPDATE dict_material_types
SET public_available = 0, sort_order = 90
WHERE type_id NOT IN ('quartz', 'granite', 'onyx');
UPDATE dict_material_types SET sort_order = 10 WHERE type_id = 'quartz';

CREATE TABLE calculator_slab_formats (
  format_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  system_code VARCHAR(40) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  length_mm INT UNSIGNED NULL,
  width_mm INT UNSIGNED NULL,
  thickness_mm INT UNSIGNED NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (format_id),
  UNIQUE KEY uq_calculator_slab_formats_code (system_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO calculator_slab_formats
  (system_code, display_name, length_mm, width_mm, thickness_mm, is_custom, sort_order)
VALUES
  ('normal', 'Normal', 3050, 1440, 20, 0, 10),
  ('jumbo', 'Jumbo', 3200, 1600, 20, 0, 20),
  ('super_jumbo', 'Super Jumbo', 3300, 1650, 20, 0, 30),
  ('custom', 'Custom', NULL, NULL, NULL, 1, 40);

ALTER TABLE materials
  ADD COLUMN series_name VARCHAR(100) NULL AFTER fabricator,
  ADD COLUMN description TEXT NULL AFTER series_name,
  ADD COLUMN image_path VARCHAR(500) NULL AFTER description,
  ADD COLUMN sku VARCHAR(100) NULL AFTER image_path,
  ADD COLUMN slab_format_id INT UNSIGNED NULL AFTER color,
  ADD COLUMN length_mm INT UNSIGNED NULL AFTER slab_format_id,
  ADD COLUMN width_mm INT UNSIGNED NULL AFTER length_mm,
  ADD COLUMN thickness_mm INT UNSIGNED NULL AFTER width_mm,
  ADD COLUMN price_unit ENUM('slab','half_slab','sqm','manual') NOT NULL DEFAULT 'sqm' AFTER thickness_mm,
  ADD COLUMN base_price_usd_cents INT UNSIGNED NOT NULL DEFAULT 0 AFTER price_unit,
  ADD COLUMN markup_bps INT UNSIGNED NOT NULL DEFAULT 0 AFTER base_price_usd_cents,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER markup_bps,
  ADD COLUMN public_available TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 100 AFTER public_available,
  ADD COLUMN price_changed_at TIMESTAMP NULL AFTER sort_order,
  ADD CONSTRAINT fk_materials_slab_format
    FOREIGN KEY (slab_format_id) REFERENCES calculator_slab_formats(format_id) ON DELETE SET NULL,
  ADD KEY idx_materials_public (is_active, public_available, type_id, sort_order);

UPDATE materials
SET base_price_usd_cents = ROUND((price_per_m2 / 3) * 100),
    price_unit = 'sqm',
    price_changed_at = CURRENT_TIMESTAMP
WHERE base_price_usd_cents = 0 AND price_per_m2 > 0;

UPDATE materials SET type_id = 'granite'
WHERE type_id = 'natural' AND title LIKE 'Гранит %';
UPDATE materials SET type_id = 'onyx'
WHERE type_id = 'natural' AND title LIKE 'Оникс %';

CREATE TABLE calculator_pricebooks (
  pricebook_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  version_number INT UNSIGNED NOT NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  exchange_rate_scaled INT UNSIGNED NOT NULL COMMENT 'BYN/USD × 10000',
  note VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  PRIMARY KEY (pricebook_id),
  UNIQUE KEY uq_calculator_pricebooks_version (version_number),
  KEY idx_calculator_pricebooks_status (status),
  CONSTRAINT fk_calculator_pricebooks_user
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE calculator_rates (
  rate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pricebook_id BIGINT UNSIGNED NOT NULL,
  system_code VARCHAR(80) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  category ENUM('production','cutout','edge','additional','installation','logistics') NOT NULL,
  unit_code ENUM('m','sqm','pcs','service') NOT NULL,
  base_price_usd_cents INT UNSIGNED NOT NULL DEFAULT 0,
  calculation_mode ENUM('unit','fixed','dependent','manual') NOT NULL DEFAULT 'unit',
  dependent_code VARCHAR(80) NULL,
  percent_bps INT UNSIGNED NULL,
  public_available TINYINT(1) NOT NULL DEFAULT 0,
  manager_available TINYINT(1) NOT NULL DEFAULT 1,
  manual_adjustment_allowed TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_id),
  UNIQUE KEY uq_calculator_rates_version_code (pricebook_id, system_code),
  CONSTRAINT fk_calculator_rates_pricebook
    FOREIGN KEY (pricebook_id) REFERENCES calculator_pricebooks(pricebook_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE calculator_settings (
  pricebook_id BIGINT UNSIGNED NOT NULL,
  reserve_bps INT UNSIGNED NOT NULL DEFAULT 1000,
  public_factor_bps INT UNSIGNED NOT NULL DEFAULT 9500,
  minimum_order_byn_cents INT UNSIGNED NOT NULL DEFAULT 0,
  rounding_step_byn_cents INT UNSIGNED NOT NULL DEFAULT 1000,
  waste_bps INT UNSIGNED NOT NULL DEFAULT 1000,
  minimum_material_markup_bps INT UNSIGNED NOT NULL DEFAULT 0,
  public_wording VARCHAR(160) NOT NULL DEFAULT 'Ориентировочная стоимость от',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (pricebook_id),
  CONSTRAINT fk_calculator_settings_pricebook
    FOREIGN KEY (pricebook_id) REFERENCES calculator_pricebooks(pricebook_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE calculator_change_history (
  change_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pricebook_id BIGINT UNSIGNED NULL,
  actor_id INT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_key VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (change_id),
  KEY idx_calculator_history_created (created_at),
  CONSTRAINT fk_calculator_history_pricebook
    FOREIGN KEY (pricebook_id) REFERENCES calculator_pricebooks(pricebook_id) ON DELETE SET NULL,
  CONSTRAINT fk_calculator_history_actor
    FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE public_calculator_leads (
  lead_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contact_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(100) NULL,
  comment VARCHAR(1000) NULL,
  configuration_json JSON NOT NULL,
  calculation_snapshot JSON NOT NULL,
  status ENUM('new','converted','rejected') NOT NULL DEFAULT 'new',
  converted_order_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lead_id),
  KEY idx_public_calculator_leads_status (status, created_at),
  CONSTRAINT fk_public_calculator_leads_order
    FOREIGN KEY (converted_order_id) REFERENCES orders(order_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO calculator_pricebooks
  (version_number, status, exchange_rate_scaled, note, published_at)
SELECT 1, 'published',
       ROUND(COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'exchange_rate'), '3') * 10000),
       'Начальный прайс калькулятора', CURRENT_TIMESTAMP;

SET @calculator_pricebook_id = LAST_INSERT_ID();

INSERT INTO calculator_settings (pricebook_id) VALUES (@calculator_pricebook_id);

INSERT INTO calculator_rates
  (pricebook_id, system_code, display_name, category, unit_code, base_price_usd_cents,
   calculation_mode, dependent_code, percent_bps, public_available,
   manager_available, manual_adjustment_allowed, is_active, sort_order)
VALUES
(@calculator_pricebook_id,'cut_straight','Прямой раскрой','production','m',500,'unit',NULL,NULL,1,1,1,1,10),
(@calculator_pricebook_id,'cut_curved','Фигурный раскрой','production','m',0,'dependent','cut_straight',13000,1,1,1,1,20),
(@calculator_pricebook_id,'cut_45','Запил или рез 45°','production','m',1000,'unit',NULL,NULL,1,1,1,1,30),
(@calculator_pricebook_id,'polish_20','Полировка 20 мм','production','m',2000,'unit',NULL,NULL,1,1,1,1,40),
(@calculator_pricebook_id,'polish_40','Полировка 40 мм','production','m',4000,'unit',NULL,NULL,1,1,1,1,50),
(@calculator_pricebook_id,'polish_custom','Нестандартная полировка','production','m',3000,'unit',NULL,NULL,0,1,1,1,60),
(@calculator_pricebook_id,'backsplash_make','Изготовление пристенного бортика','production','m',1000,'unit',NULL,NULL,1,1,1,1,70),
(@calculator_pricebook_id,'hole_faucet','Отверстие под кран','cutout','pcs',1000,'unit',NULL,NULL,1,1,1,1,100),
(@calculator_pricebook_id,'hole_socket','Отверстие под розетку','cutout','pcs',1000,'unit',NULL,NULL,1,1,1,1,110),
(@calculator_pricebook_id,'hole_dispenser','Отверстие под дозатор','cutout','pcs',1000,'unit',NULL,NULL,1,1,1,1,120),
(@calculator_pricebook_id,'hole_standard','Прочее стандартное отверстие','cutout','pcs',1000,'unit',NULL,NULL,1,1,1,1,130),
(@calculator_pricebook_id,'cutout_hob','Вырез под варочную панель','cutout','pcs',4000,'unit',NULL,NULL,1,1,1,1,140),
(@calculator_pricebook_id,'cutout_sink_top','Вырез под накладную мойку','cutout','pcs',4000,'unit',NULL,NULL,1,1,1,1,150),
(@calculator_pricebook_id,'cutout_sink_under','Вырез под мойку снизу','cutout','pcs',5000,'unit',NULL,NULL,1,1,1,1,160),
(@calculator_pricebook_id,'cutout_round','Вырез овальной или круглой формы','cutout','pcs',7000,'unit',NULL,NULL,1,1,1,1,170),
(@calculator_pricebook_id,'manual_polish_small','Ручная полировка площади до 1 м²','production','service',5000,'fixed',NULL,NULL,0,1,1,1,180),
(@calculator_pricebook_id,'manual_polish_large','Ручная полировка площади более 1 м²','production','service',8000,'fixed',NULL,NULL,0,1,1,1,190),
(@calculator_pricebook_id,'joint_short','Стык до 70 см','production','pcs',4000,'unit',NULL,NULL,1,1,1,1,200),
(@calculator_pricebook_id,'joint_long','Стык более 70 см','production','pcs',8000,'unit',NULL,NULL,1,1,1,1,210),
(@calculator_pricebook_id,'edge_standard','Стандартная обработка','edge','m',2000,'unit',NULL,NULL,1,1,1,1,220),
(@calculator_pricebook_id,'edge_round','Овальная или круглая','edge','m',3000,'unit',NULL,NULL,1,1,1,1,230),
(@calculator_pricebook_id,'edge_reinforced','Усиленная, более 40 мм','edge','m',4000,'unit',NULL,NULL,1,1,1,1,240),
(@calculator_pricebook_id,'stone_sink','Мойка из камня','additional','pcs',30000,'unit',NULL,NULL,1,1,1,1,250),
(@calculator_pricebook_id,'backsplash','Пристенный бортик','additional','m',1000,'unit',NULL,NULL,1,1,1,1,260),
(@calculator_pricebook_id,'wall_panel','Скинали','additional','m',1500,'unit',NULL,NULL,1,1,1,1,270),
(@calculator_pricebook_id,'install_countertop','Монтаж столешницы шириной до 70 см','installation','m',2500,'unit',NULL,NULL,1,1,1,1,300),
(@calculator_pricebook_id,'install_wall_panel','Монтаж скинали','installation','m',1500,'unit',NULL,NULL,1,1,1,1,310),
(@calculator_pricebook_id,'install_plinth','Монтаж плинтуса','installation','m',500,'unit',NULL,NULL,1,1,1,1,320),
(@calculator_pricebook_id,'install_plinth_corner','Угловой элемент плинтуса','installation','pcs',500,'unit',NULL,NULL,1,1,1,1,330),
(@calculator_pricebook_id,'install_sink','Вклейка мойки','installation','pcs',1000,'unit',NULL,NULL,1,1,1,1,340),
(@calculator_pricebook_id,'install_corner_countertop','Угловая столешница','installation','pcs',1000,'unit',NULL,NULL,1,1,1,1,350),
(@calculator_pricebook_id,'install_sill','Каменный бордюр или подоконник','installation','m',1000,'unit',NULL,NULL,1,1,1,1,360),
(@calculator_pricebook_id,'table_unconfirmed','Стол','additional','service',1667,'manual',NULL,NULL,0,0,1,0,900);
