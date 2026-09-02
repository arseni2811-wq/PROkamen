const test = require("node:test");
const assert = require("node:assert/strict");
const {
  orderSchema,
  orderUpdateSchema,
  calculatorUpdateSchema,
  calculatorPreviewSchema,
  materialSchema,
  statusUpdateSchema,
} = require("../middleware/schemas");

test("calculator preview accepts island and bar geometry", () => {
  const item = (productType) => ({
    productType,
    shape: "straight",
    pieces: [{ lengthMm: 1800, widthMm: productType === "island" ? 900 : 500 }],
    automaticGeometry: true,
    polishedSides: 4,
    roundedCorners: productType === "island" ? 4 : 0,
    cornerRadiusMm: 50,
    edgeCode: "edge_standard",
    operations: [],
  });
  const result = calculatorPreviewSchema.safeParse({
    materialId: "stone-1",
    slabFormatCode: "normal",
    configuration: {
      items: [item("island"), item("bar")],
      operations: [],
      additionalLines: [],
    },
  });
  assert.equal(result.success, true);
});

test("calculator preview accepts table shape and automatic skinali perimeter", () => {
  const result = calculatorPreviewSchema.safeParse({
    materialId: "stone-1",
    slabFormatCode: "normal",
    configuration: {
      items: [{
        productType: "table",
        shape: "straight",
        tableShape: "oval",
        pieces: [{ lengthMm: 1600, widthMm: 900 }],
        automaticGeometry: true,
        polishedSides: 4,
        wallPanelAutoLength: true,
        edgeCode: "edge_standard",
        edgeProfileModel: "model_7",
        operations: [],
      }],
      operations: [],
      additionalLines: [],
    },
  });
  assert.equal(result.success, true);
  assert.equal(result.data.configuration.items[0].edgeProfileModel, "model_7");
});

test("mutating an existing order requires an expected version", () => {
  assert.equal(orderUpdateSchema.safeParse({ prepayment: 10 }).success, false);
  assert.equal(
    orderUpdateSchema.safeParse({ version: 1, prepayment: 10 }).success,
    true,
  );
});

test("calculator update validates the single-item snapshot contract", () => {
  const result = calculatorUpdateSchema.safeParse({
    version: 1,
    total_amount: 1000,
    exchange_rate: 3.2,
    calculator_snapshot: {
      isInitialized: true,
      length: 2000,
      width: 600,
      isThickEdge: false,
      edgeFront: true,
      edgeLeft: false,
      edgeRight: false,
      plinthBack: true,
      plinthLeft: false,
      plinthRight: false,
      stoneId: "stone-1",
      stoneName: "Stone",
      slabAmt: 1,
      isAutoSlab: true,
      customSlabPrice: 0,
      sinkUnder: 0,
      sinkTop: 0,
      joint: 0,
      hole: 0,
      deliveryBYN: 0,
      installBYN: 0,
      cutStraight: 0,
      cut45: 0,
      edge20: 2,
      edge40: 0,
      plinth: 2,
      matUSD: 10,
      prodUSD: 5,
      suggestedTotal: 1000,
    },
  });
  assert.equal(result.success, true);
});

test("order validation rejects impossible calendar dates", () => {
  assert.equal(
    orderSchema.safeParse({ deadline_date: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    orderSchema.safeParse({ deadline_date: "2028-02-29" }).success,
    true,
  );
});

test("new-order form payload matches the create contract", () => {
  const result = orderSchema.safeParse({
    manager_id: 6,
    status_id: "lead",
    total_amount: 721,
    prepayment: 0,
    installation_address: "Тестовый адрес",
    order_source: "Дипломный сценарий",
    stone_name: "Тестовый камень",
    product_type: "Столешница",
    deadline_date: "2026-09-19",
    deadlines: { measurement: "2026-08-31", final_calculation: "2026-09-19" },
    client: {
      full_name: "Тестовый клиент",
      phone: "+375291234567",
      email: "test@example.invalid",
      address: "Тестовый адрес",
      social_networks: "нет",
    },
    exchange_rate: 3.2,
    calculator_snapshot: { isInitialized: true, suggestedTotal: 721 },
    items: [
      {
        product_type_id: 1,
        material_id: "custom",
        length_mm: 2000,
        width_mm: 600,
        area_m2: 1.2,
        edge_profile_id: 1,
        edge_length_m: 2,
        item_cost: 721,
      },
    ],
  });
  assert.equal(result.success, true);
});

test("order validation matches actual varchar column limits", () => {
  assert.equal(
    orderSchema.safeParse({ installation_address: "x".repeat(256) }).success,
    false,
  );
  assert.equal(
    orderSchema.safeParse({ client: { email: "x".repeat(46) } }).success,
    false,
  );
  assert.equal(
    materialSchema.safeParse({
      title: "x".repeat(101),
      price_per_m2: 1,
    }).success,
    false,
  );
});

test("order item validation rejects unknown and out-of-range fields", () => {
  assert.equal(
    orderSchema.safeParse({ items: [{ material_id: "m1", item_cost: 10 }] })
      .success,
    true,
  );
  assert.equal(
    orderSchema.safeParse({ items: [{ material_id: "m1", admin: true }] })
      .success,
    false,
  );
  assert.equal(
    orderSchema.safeParse({ items: [{ material_id: "x".repeat(51) }] }).success,
    false,
  );
});

test("status validation preserves a bounded audit comment", () => {
  const result = statusUpdateSchema.safeParse({
    version: 1,
    status_id: "cancelled",
    comment: "Клиент отказался",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.comment, "Клиент отказался");
  assert.equal(
    statusUpdateSchema.safeParse({
      version: 1,
      status_id: "cancelled",
      comment: "x".repeat(401),
    }).success,
    false,
  );
});
