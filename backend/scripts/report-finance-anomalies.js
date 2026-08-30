const pool = require("../db");

async function main() {
  const [rows] = await pool.query(`
    SELECT
      o.order_id,
      CASE
        WHEN f.order_id IS NULL THEN 'missing_finance'
        ELSE 'amount_mismatch'
      END AS problem,
      o.total_amount,
      o.prepayment,
      f.total_revenue_cents,
      f.prepayment_cents,
      f.balance_cents,
      (o.calculator_snapshot IS NOT NULL) AS has_calculator_snapshot,
      EXISTS(
        SELECT 1 FROM order_history_log h WHERE h.order_id = o.order_id
      ) AS has_history
    FROM orders o
    LEFT JOIN order_finances f ON f.order_id = o.order_id
    WHERE f.order_id IS NULL
       OR f.total_revenue_cents<>ROUND(COALESCE(o.total_amount,0)*100)
       OR f.prepayment_cents<>ROUND(COALESCE(o.prepayment,0)*100)
       OR f.balance_cents<>f.total_revenue_cents-f.prepayment_cents
    ORDER BY o.order_id
  `);
  console.log(JSON.stringify({ count: rows.length, anomalies: rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(`Finance anomaly report failed: ${error.code || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
