ALTER TABLE order_finances
  ADD CONSTRAINT uq_order_finances_order UNIQUE (order_id);
