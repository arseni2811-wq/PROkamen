"use strict";

const pool = require("../db");

const expectedByn = {
  cut_straight: 15,
  cut_45: 30,
  polish_20: 60,
  polish_40: 120,
  polish_custom: 90,
  backsplash_make: 30,
  hole_faucet: 30,
  hole_socket: 30,
  hole_dispenser: 30,
  hole_standard: 30,
  cutout_hob: 120,
  cutout_sink_top: 120,
  cutout_sink_under: 150,
  cutout_round: 210,
  manual_polish_small: 150,
  manual_polish_large: 240,
  joint_short: 120,
  joint_long: 240,
  edge_standard: 60,
  edge_round: 90,
  edge_reinforced: 120,
  stone_sink: 900,
  backsplash: 30,
  wall_panel: 45,
  install_countertop: 75,
  install_wall_panel: 45,
  install_plinth: 15,
  install_plinth_corner: 15,
  install_sink: 30,
  install_corner_countertop: 30,
  install_sill: 30,
};

async function auditPricebook() {
  const [rows] = await pool.query(
    `SELECT r.system_code, r.display_name, r.base_price_usd_cents,
            r.calculation_mode, r.dependent_code, r.percent_bps,
            r.is_active, p.version_number, p.exchange_rate_scaled
     FROM calculator_rates r
     JOIN calculator_pricebooks p ON p.pricebook_id = r.pricebook_id
     WHERE p.status = 'published'`,
  );
  if (!rows.length) throw new Error("Опубликованный прайс не найден");
  const byCode = new Map(rows.map((row) => [row.system_code, row]));
  const mismatches = [];
  for (const [code, expected] of Object.entries(expectedByn)) {
    const row = byCode.get(code);
    if (!row) {
      mismatches.push({ code, expected, actual: "missing" });
      continue;
    }
    const actual = Number(row.base_price_usd_cents) * Number(row.exchange_rate_scaled) / 1000000;
    if (Math.abs(actual - expected) > 0.001) mismatches.push({ code, expected, actual });
  }
  const curved = byCode.get("cut_curved");
  if (!curved || curved.dependent_code !== "cut_straight" || Number(curved.percent_bps) !== 13000) {
    mismatches.push({ code: "cut_curved", expected: "cut_straight × 1.30", actual: curved || "missing" });
  }
  const result = {
    success: mismatches.length === 0,
    pricebookVersion: Number(rows[0].version_number),
    exchangeRate: Number(rows[0].exchange_rate_scaled) / 10000,
    matchedFixedRates: Object.keys(expectedByn).length,
    matchedDependentRates: mismatches.some((item) => item.code === "cut_curved") ? 0 : 1,
    mismatches,
    note: "Позиция «Стол — 50 BYN» не включена в автоматический аудит: в справочнике не указана единица расчёта; менеджер добавляет её отдельной ручной строкой.",
  };
  if (!result.success) throw Object.assign(new Error("Тарифы не совпадают со справочником"), { result });
  return result;
}

if (require.main === module) {
  auditPricebook()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify(error.result || { success: false, message: error.message }, null, 2));
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { auditPricebook, expectedByn };
