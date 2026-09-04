CREATE TABLE calculator_exchange_rates (
  exchange_rate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pricebook_id BIGINT UNSIGNED NOT NULL,
  currency_code CHAR(3) NOT NULL,
  byn_per_unit_scaled BIGINT UNSIGNED NOT NULL,
  rate_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (exchange_rate_id),
  UNIQUE KEY uq_calculator_exchange_rates_pricebook_currency (pricebook_id, currency_code),
  CONSTRAINT chk_calculator_exchange_rates_currency CHECK (currency_code IN ('USD', 'EUR', 'RUB')),
  CONSTRAINT chk_calculator_exchange_rates_positive CHECK (byn_per_unit_scaled > 0),
  CONSTRAINT fk_calculator_exchange_rates_pricebook
    FOREIGN KEY (pricebook_id) REFERENCES calculator_pricebooks(pricebook_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO calculator_exchange_rates (pricebook_id, currency_code, byn_per_unit_scaled)
SELECT pricebook_id, 'USD', exchange_rate_scaled
FROM calculator_pricebooks;
