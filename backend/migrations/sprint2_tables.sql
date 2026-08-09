-- =========================================================
-- SPRINT 2: Таблицы для финансов и системных настроек
-- =========================================================

-- 1. Таблица системных настроек (ключ-значение)
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Вставляем курс валют по умолчанию (3.2 BYN за 1 USD)
INSERT INTO system_settings (setting_key, setting_value) 
VALUES ('exchange_rate', '3.2')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

-- 2. Таблица финансов заказов
CREATE TABLE IF NOT EXISTS order_finances (
  finance_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  stone_category ENUM('acrylic', 'quartz', 'other') NOT NULL DEFAULT 'other',
  material_cost_cents INT NOT NULL DEFAULT 0 COMMENT 'Себестоимость материалов в центах',
  production_cost_cents INT NOT NULL DEFAULT 0 COMMENT 'Производственные затраты в центах',
  total_revenue_cents INT NOT NULL DEFAULT 0 COMMENT 'Общая выручка в центах',
  prepayment_cents INT NOT NULL DEFAULT 0 COMMENT 'Предоплата в центах',
  balance_cents INT NOT NULL DEFAULT 0 COMMENT 'Остаток к оплате в центах',
  currency VARCHAR(3) NOT NULL DEFAULT 'BYN',
  exchange_rate DECIMAL(10,4) NULL COMMENT 'Курс USD/BYN на момент расчета',
  calculation_snapshot JSON NULL COMMENT 'Снимок калькуляции',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  INDEX idx_order_finance_order (order_id),
  INDEX idx_order_finance_category (stone_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Добавляем колонку stone_category в order_items для определения категории камня
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS stone_category ENUM('acrylic', 'quartz', 'other') DEFAULT 'other' 
COMMENT 'Категория камня для финансового учета' 
AFTER material_id;

-- 4. Создаем индекс для быстрого поиска по категории камня
CREATE INDEX IF NOT EXISTS idx_order_items_category ON order_items(stone_category);

-- =========================================================
-- Проверка создания
-- =========================================================
SELECT 'system_settings' as table_name, COUNT(*) as row_count FROM system_settings
UNION ALL
SELECT 'order_finances', COUNT(*) FROM order_finances;

</parameter>
<task_progress>
- [x] Analyze current server.js structure
- [x] Create modular folder structure (routes, controllers, middleware)
- [x] Extract middleware (auth, validation, role checks)
- [x] Create route files (orders, materials, auth)
- [ ] Create SQL tables (system_settings, order_finances)
- [ ] Update controllers for finance integration
- [ ] Create exchange rate endpoint
- [ ] Test server startup
- [ ] Create SPRINT2_IMPLEMENTATION_SUMMARY.md
</task_progress>
</write_to_file>