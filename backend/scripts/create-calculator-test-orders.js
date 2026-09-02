"use strict";

const jwt = require("jsonwebtoken");
const pool = require("../db");
require("dotenv").config({ quiet: true });

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const runId = process.argv[2] || `QA-${Date.now()}`;

async function readJson(response, expected) {
  const body = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(`${response.request?.method || "HTTP"} ${response.url}: ${response.status} ${body.message || ""}`);
  }
  return body;
}

function baseConfiguration(items, operations, additionalLines = []) {
  return {
    items,
    operations,
    additionalLines,
    manualSlabCount: null,
    manualMaterialPriceUsdCents: 0,
    materialMarkupBps: 0,
    additionalMaterialBynCents: 0,
    managerAdjustmentBynCents: 0,
  };
}

async function preview(payload, headers = {}) {
  return readJson(await fetch(`${baseUrl}/api/calculator/preview`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  }), 200);
}

async function createOrder(headers, scenario, snapshot) {
  const created = await readJson(await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": `${runId}-${scenario.key}`, ...headers },
    body: JSON.stringify({
      client: scenario.client,
      status_id: "lead",
      order_source: `Автотест калькулятора ${runId}`,
      stone_name: snapshot.material.title,
      product_type: scenario.productTypeLabel,
      items: [{
        product_type_id: scenario.productTypeId,
        material_id: scenario.payload.materialId,
        edge_profile_id: scenario.edgeProfileId,
      }],
    }),
  }), 201);
  const current = await readJson(await fetch(`${baseUrl}/api/orders/${created.order_id}`, { headers }), 200);
  const saved = await readJson(await fetch(`${baseUrl}/api/orders/${created.order_id}/calculator`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      version: current.order.version,
      total_amount: snapshot.totals.finalQuoteTotalCents / 100,
      exchange_rate: snapshot.exchangeRate,
      calculator_snapshot: snapshot,
    }),
  }), 200);
  const verified = await readJson(await fetch(`${baseUrl}/api/orders/${created.order_id}`, { headers }), 200);
  return {
    orderId: created.order_id,
    version: saved.version,
    client: verified.order.client_name,
    product: scenario.productTypeLabel,
    shape: scenario.shape,
    material: snapshot.material.title,
    areaM2: snapshot.metrics.areaM2,
    slabs: snapshot.material.slabCount,
    technicalByn: snapshot.totals.technicalTotalCents / 100,
    reserveByn: snapshot.totals.reserveCents / 100,
    finalByn: snapshot.totals.finalQuoteTotalCents / 100,
    persistedTotalByn: Number(verified.order.total_amount),
    snapshotSchema: verified.order.calculator_snapshot?.schemaVersion,
  };
}

async function main() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  const [[manager]] = await pool.query("SELECT user_id, role_id FROM users WHERE role_id = 2 ORDER BY user_id LIMIT 1");
  if (!manager) throw new Error("Менеджер для теста не найден");
  const token = jwt.sign({ user_id: manager.user_id, role_id: manager.role_id }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const headers = { authorization: `Bearer ${token}` };

  const publicPayload = {
    materialId: "quartz-avant-7000",
    slabFormatCode: "normal",
    configuration: baseConfiguration([
      { productType: "countertop", shape: "straight", pieces: [{ lengthMm: 2900, widthMm: 600 }], edgeCode: "edge_standard", processedEdgeM: 2.9, operations: [] },
    ], [
      { code: "cutout_hob", quantity: 1 },
      { code: "hole_faucet", quantity: 1 },
      { code: "install_countertop", quantity: 2.9 },
    ]),
  };
  const publicLead = await readJson(await fetch(`${baseUrl}/api/public/calculator/leads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...publicPayload,
      contact: {
        name: `[ТЕСТ] Публичный калькулятор ${runId}`,
        phone: "+375290000091",
        email: "qa-calculator@example.test",
        comment: `Автоматическая проверка ${runId}; не связываться`,
      },
    }),
  }), 201);

  const scenarios = [
    {
      key: "granite-l",
      shape: "Г-образная",
      productTypeId: 1,
      productTypeLabel: "Столешница",
      edgeProfileId: 2,
      client: { full_name: `[ТЕСТ] Столешница L ${runId}`, phone: "+375290000092", email: "qa-l@example.test" },
      payload: {
        materialId: "granite-black",
        slabFormatCode: "normal",
        configuration: baseConfiguration([
          { productType: "countertop", shape: "l", pieces: [{ lengthMm: 2400, widthMm: 600 }, { lengthMm: 1600, widthMm: 600 }], edgeCode: "edge_round", processedEdgeM: 4, operations: [] },
        ], [
          { code: "cutout_sink_under", quantity: 1 },
          { code: "joint_long", quantity: 1 },
          { code: "install_countertop", quantity: 4 },
        ], [
          { name: "Тестовая доставка", quantity: 1, unit: "услуга", unitPriceCents: 12000, currency: "BYN", category: "logistics", comment: runId },
        ]),
      },
    },
    {
      key: "onyx-u-sill",
      shape: "П-образная",
      productTypeId: 4,
      productTypeLabel: "Подоконник",
      edgeProfileId: 1,
      client: { full_name: `[ТЕСТ] Подоконник U ${runId}`, phone: "+375290000093", email: "qa-u@example.test" },
      payload: {
        materialId: "onyx-honey",
        slabFormatCode: "jumbo",
        configuration: baseConfiguration([
          { productType: "windowsill", shape: "u", pieces: [{ lengthMm: 1600, widthMm: 350 }, { lengthMm: 1100, widthMm: 350 }, { lengthMm: 900, widthMm: 350 }], edgeCode: "edge_standard", processedEdgeM: 3.6, operations: [] },
        ], [
          { code: "hole_standard", quantity: 2 },
          { code: "install_sill", quantity: 3.6 },
        ]),
      },
    },
  ];

  const orders = [];
  for (const scenario of scenarios) {
    const calculated = await preview(scenario.payload, headers);
    orders.push(await createOrder(headers, scenario, calculated.calculation));
  }
  console.log(JSON.stringify({
    success: true,
    runId,
    publicLead: {
      leadId: publicLead.leadId,
      publicFromByn: publicLead.calculation.publicFromTotal,
      areaM2: publicLead.calculation.metrics.areaM2,
      material: publicLead.calculation.material.title,
    },
    orders,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
