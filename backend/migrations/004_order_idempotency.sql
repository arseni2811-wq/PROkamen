CREATE TABLE order_idempotency_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id INT NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  order_id INT NULL,
  response_status SMALLINT UNSIGNED NULL,
  response_body JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_idempotency_actor_key (actor_id, idempotency_key),
  KEY idx_order_idempotency_order (order_id),
  CONSTRAINT fk_order_idempotency_actor
    FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_idempotency_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
