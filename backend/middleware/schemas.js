const { z } = require("zod");

const dateOnlySchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}, "Некорректная календарная дата");

const nullableNonNegativeNumber = (max) =>
  z.coerce.number().finite().min(0).max(max).optional().nullable();

const orderItemSchema = z
  .object({
    product_type_id: z.coerce.number().int().positive().optional().nullable(),
    productTypeId: z.coerce.number().int().positive().optional().nullable(),
    material_id: z.string().trim().min(1).max(50).optional().nullable(),
    materialId: z.string().trim().min(1).max(50).optional().nullable(),
    length_mm: nullableNonNegativeNumber(1000000),
    lengthMm: nullableNonNegativeNumber(1000000),
    width_mm: nullableNonNegativeNumber(1000000),
    widthMm: nullableNonNegativeNumber(1000000),
    area_m2: nullableNonNegativeNumber(99999.999),
    areaM2: nullableNonNegativeNumber(99999.999),
    edge_profile_id: z.coerce.number().int().positive().optional().nullable(),
    edgeProfileId: z.coerce.number().int().positive().optional().nullable(),
    edge_length_m: nullableNonNegativeNumber(999999.99),
    edgeLengthM: nullableNonNegativeNumber(999999.99),
    item_cost: nullableNonNegativeNumber(99999999.99),
    itemCost: nullableNonNegativeNumber(99999999.99),
  })
  .strict();

// Схема для создания/обновления заказа
// Все второстепенные поля — optional + nullable: фронтенд может
// прислать null, undefined или не прислать поле вовсе.
// .optional()  → пропускает undefined и отсутствие поля
// .nullable()  → пропускает null
const orderSchema = z.object({
  // total_amount/prepayment хранятся в РУБЛЯХ (DECIMAL(10,2)).
  // Верхняя граница 20 000 000 BYN согласована с колонками *_cents (INT) в
  // order_finances: 20 000 000 × 100 = 2 000 000 000 < INT.MAX (2 147 483 647).
  // Большие значения падали с "Out of range value for column ...".
  total_amount: z.coerce.number().min(0).max(20000000).optional().nullable(),
  prepayment: z.coerce.number().min(0).max(20000000).optional().nullable(),
  installation_address: z.string().max(255).optional().nullable(),
  order_source: z.string().max(255).optional().nullable(),
  stone_name: z.string().max(255).optional().nullable(),
  product_type: z.string().max(255).optional().nullable(),
  deadline_date: dateOnlySchema.optional().nullable(),
  status_id: z
    .enum([
      "lead",
      "new",
      "measurement",
      "quote_approval",
      "waiting_payment",
      "waiting_stone",
      "in_production",
      "ready_shipping",
      "logistics_install",
      "final_calculation",
      "archived",
      "cancelled",
    ])
    .optional()
    .nullable(),
  // client может быть null целиком ("клиент не выбран") ИЛИ объектом,
  // у которого отдельные поля тоже могут быть null (phone/email пустые)
  client: z
    .object({
      full_name: z.string().min(1).max(100).optional().nullable(),
      phone: z.string().max(20).optional().nullable(),
      // email: смягчённая валидация — только ограничение длины колонки (45).
      // null/undefined/пустая строка пропускаются, формат НЕ проверяется,
      // чтобы не блокировать сохранение заказа из-за email клиента.
      email: z.string().max(45).optional().nullable(),
      address: z.string().max(500).optional().nullable(),
      social_networks: z.string().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
  client_id: z.number().int().positive().optional().nullable(),
  manager_id: z.number().int().positive().optional().nullable(),
  exchange_rate: z.coerce
    .number()
    .positive()
    .max(999999.9999)
    .optional()
    .nullable(),
  calculator_snapshot: z.any().optional().nullable(),
  deadlines: z.any().optional().nullable(),
  items: z.array(orderItemSchema).max(100).optional().nullable(),
});

const orderUpdateSchema = orderSchema.extend({
  version: z.coerce.number().int().positive(),
});

const calculatorNumber = (max) => z.coerce.number().finite().min(0).max(max);
const calculatorSnapshotSchema = z
  .object({
    isInitialized: z.literal(true),
    length: calculatorNumber(1000000),
    width: calculatorNumber(1000000),
    isThickEdge: z.boolean(),
    edgeFront: z.boolean(),
    edgeLeft: z.boolean(),
    edgeRight: z.boolean(),
    plinthBack: z.boolean(),
    plinthLeft: z.boolean(),
    plinthRight: z.boolean(),
    stoneId: z.string().trim().min(1).max(50),
    stoneName: z.string().trim().max(255).optional().nullable(),
    slabAmt: calculatorNumber(10000),
    isAutoSlab: z.boolean(),
    customSlabPrice: calculatorNumber(20000000),
    sinkUnder: calculatorNumber(10000),
    sinkTop: calculatorNumber(10000),
    joint: calculatorNumber(10000),
    hole: calculatorNumber(10000),
    deliveryBYN: calculatorNumber(20000000),
    installBYN: calculatorNumber(20000000),
    cutStraight: calculatorNumber(999999.99),
    cut45: calculatorNumber(999999.99),
    edge20: calculatorNumber(999999.99),
    edge40: calculatorNumber(999999.99),
    plinth: calculatorNumber(999999.99),
    matUSD: calculatorNumber(20000000),
    prodUSD: calculatorNumber(20000000),
    suggestedTotal: calculatorNumber(20000000),
  })
  .passthrough();

const calculatorUpdateSchema = z.object({
  version: z.coerce.number().int().positive(),
  total_amount: z.coerce.number().finite().min(0).max(20000000),
  exchange_rate: z.coerce.number().positive().max(999999.9999).nullable(),
  calculator_snapshot: calculatorSnapshotSchema,
});

// Схема для материала
const materialSchema = z.object({
  material_id: z.string().optional(),
  // type_id приходит и строкой ("quartz"), и числом (фронтенд админки шлёт 1)
  type_id: z.union([z.string(), z.number()]).nullable().optional(),
  title: z.string().min(1).max(100),
  fabricator: z.string().max(100).nullable().optional(),
  price_per_m2: z.number().min(0),
});

// Схема для услуг
const servicesSchema = z.object({
  services: z.record(z.string(), z.number().min(0)).optional(),
});

// Схема для обновления статуса
const statusUpdateSchema = z.object({
  version: z.coerce.number().int().positive(),
  status_id: z.enum([
    "lead",
    "new",
    "measurement",
    "quote_approval",
    "waiting_payment",
    "waiting_stone",
    "in_production",
    "ready_shipping",
    "logistics_install",
    "final_calculation",
    "archived",
    "cancelled",
  ]),
  comment: z.string().trim().max(400).optional().nullable(),
});

// Схема для логина
const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

module.exports = {
  orderSchema,
  orderUpdateSchema,
  calculatorUpdateSchema,
  materialSchema,
  servicesSchema,
  statusUpdateSchema,
  loginSchema,
};
