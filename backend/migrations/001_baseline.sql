CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_roles (
  role_id INT NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL,
  description VARCHAR(100) NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  user_id INT NOT NULL AUTO_INCREMENT,
  role_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  login VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_login (login),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES dict_roles(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_lead_sources (
  source_id INT NOT NULL AUTO_INCREMENT,
  source_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (source_id),
  UNIQUE KEY uq_lead_source_name (source_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clients (
  client_id INT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  source_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email VARCHAR(45) NULL,
  address VARCHAR(500) NULL,
  social_networks VARCHAR(500) NULL,
  PRIMARY KEY (client_id),
  KEY idx_clients_source (source_id),
  KEY idx_phone (phone),
  CONSTRAINT fk_clients_source FOREIGN KEY (source_id) REFERENCES dict_lead_sources(source_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_order_statuses (
  status_id VARCHAR(20) NOT NULL,
  status_name VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL,
  PRIMARY KEY (status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_material_types (
  type_id VARCHAR(20) NOT NULL,
  type_name_ru VARCHAR(50) NOT NULL,
  PRIMARY KEY (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_product_types (
  type_id INT NOT NULL AUTO_INCREMENT,
  type_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_edge_profiles (
  profile_id INT NOT NULL AUTO_INCREMENT,
  profile_name VARCHAR(50) NOT NULL,
  price_per_meter DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dict_services (
  service_id INT NOT NULL AUTO_INCREMENT,
  service_name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (service_id),
  UNIQUE KEY uq_services_name (service_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials (
  material_id VARCHAR(50) NOT NULL,
  type_id VARCHAR(20) NOT NULL,
  title VARCHAR(100) NOT NULL,
  fabricator VARCHAR(100) NULL,
  color VARCHAR(50) NULL,
  price_per_m2 DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (material_id),
  KEY idx_materials_type (type_id),
  CONSTRAINT fk_materials_type FOREIGN KEY (type_id) REFERENCES dict_material_types(type_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  order_id INT NOT NULL AUTO_INCREMENT,
  client_id INT NOT NULL,
  manager_id INT NOT NULL,
  status_id VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deadline_date DATE NULL,
  installation_address VARCHAR(255) NULL,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  exchange_rate DECIMAL(10,4) NULL,
  calculator_snapshot JSON NULL,
  prepayment DECIMAL(10,2) DEFAULT 0.00,
  order_source VARCHAR(255) NULL,
  stone_name VARCHAR(255) NULL,
  deadlines JSON NULL,
  product_type VARCHAR(255) NULL,
  PRIMARY KEY (order_id),
  KEY idx_status (status_id),
  KEY idx_client (client_id),
  KEY idx_manager (manager_id),
  CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_manager FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_status FOREIGN KEY (status_id) REFERENCES dict_order_statuses(status_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  item_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_type_id INT NOT NULL,
  material_id VARCHAR(50) NOT NULL,
  stone_category ENUM('acrylic','quartz','other') DEFAULT 'other',
  length_mm INT NOT NULL,
  width_mm INT NOT NULL,
  area_m2 DECIMAL(8,3) NOT NULL,
  edge_profile_id INT NULL,
  edge_length_m DECIMAL(8,2) NULL,
  item_cost DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (item_id),
  KEY idx_order (order_id),
  KEY idx_order_items_product_type (product_type_id),
  KEY idx_order_items_material (material_id),
  KEY idx_order_items_edge_profile (edge_profile_id),
  KEY idx_order_items_category (stone_category),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product_type FOREIGN KEY (product_type_id) REFERENCES dict_product_types(type_id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_edge_profile FOREIGN KEY (edge_profile_id) REFERENCES dict_edge_profiles(profile_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_services (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  service_id INT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_services_order (order_id),
  KEY idx_order_services_service (service_id),
  CONSTRAINT fk_order_services_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_services_service FOREIGN KEY (service_id) REFERENCES dict_services(service_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  payment_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_attachments (
  attachment_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type ENUM('document','photo') NOT NULL DEFAULT 'document',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attachment_id),
  KEY idx_order_attachments_order (order_id),
  CONSTRAINT fk_order_attachments_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_history_log (
  log_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_history_order (order_id),
  KEY idx_history_user (user_id),
  CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_finances (
  finance_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  stone_category ENUM('acrylic','quartz','other') NOT NULL DEFAULT 'other',
  material_cost_cents INT NOT NULL DEFAULT 0,
  production_cost_cents INT NOT NULL DEFAULT 0,
  total_revenue_cents INT NOT NULL DEFAULT 0,
  prepayment_cents INT NOT NULL DEFAULT 0,
  balance_cents INT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'BYN',
  exchange_rate DECIMAL(10,4) NULL,
  calculation_snapshot JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (finance_id),
  KEY idx_order_finance_order (order_id),
  KEY idx_order_finance_category (stone_category),
  CONSTRAINT fk_order_finance_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO dict_roles (role_id, role_name, description) VALUES
  (1, 'admin', 'Администратор'),
  (2, 'manager', 'Менеджер'),
  (3, 'worker', 'Работник');

INSERT INTO dict_material_types (type_id, type_name_ru) VALUES
  ('quartz', 'Кварцевый агломерат'),
  ('acrylic', 'Акриловый камень'),
  ('other', 'Прочее');

INSERT INTO dict_product_types (type_id, type_name) VALUES
  (1, 'Изделие');

INSERT INTO dict_edge_profiles (profile_id, profile_name, price_per_meter) VALUES
  (1, 'Стандартная кромка', 0.00),
  (2, 'Склейка 40 мм', 0.00);

INSERT INTO dict_order_statuses (status_id, status_name, sort_order) VALUES
  ('lead', 'Лид', 1),
  ('new', 'Новая заявка', 5),
  ('measurement', 'Замер / Выезд', 15),
  ('quote_approval', 'Согласование КП', 22),
  ('waiting_payment', 'Ожидание оплаты', 25),
  ('waiting_stone', 'Ожидание камня', 28),
  ('in_production', 'В производстве', 32),
  ('ready_shipping', 'Готов к отгрузке', 35),
  ('logistics_install', 'Доставка и монтаж', 42),
  ('final_calculation', 'Финальный расчет', 45),
  ('archived', 'Архив', 55),
  ('cancelled', 'Отменен', 60);

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('exchange_rate', '3.2');
