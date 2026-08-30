const pool = require("../db");

async function main() {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM orders o LEFT JOIN order_finances f ON f.order_id=o.order_id
        WHERE f.order_id IS NULL) AS missing_finances,
      (SELECT COUNT(*) FROM (
        SELECT order_id FROM order_finances GROUP BY order_id HAVING COUNT(*) > 1
      ) duplicates) AS duplicate_finance_orders,
      (SELECT COUNT(*) FROM order_items i LEFT JOIN orders o ON o.order_id=i.order_id
        WHERE o.order_id IS NULL) AS orphan_items,
      (SELECT COUNT(*) FROM order_attachments a LEFT JOIN orders o ON o.order_id=a.order_id
        WHERE o.order_id IS NULL) AS orphan_attachments,
      (SELECT COUNT(*) FROM orders o JOIN order_finances f ON f.order_id=o.order_id
        WHERE f.total_revenue_cents<>ROUND(COALESCE(o.total_amount,0)*100)
           OR f.prepayment_cents<>ROUND(COALESCE(o.prepayment,0)*100)
           OR f.balance_cents<>f.total_revenue_cents-f.prepayment_cents) AS finance_mismatches
  `);
  console.log(JSON.stringify(rows[0]));
}

main()
  .catch((error) => {
    console.error(`Integrity check failed: ${error.code || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
