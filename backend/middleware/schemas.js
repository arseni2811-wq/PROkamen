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

const calculatorOperationSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    quantity: z.coerce.number().finite().min(0).max(100000),
  })
  .strict();

const calculatorPieceSchema = z
  .object({
    lengthMm: z.coerce.number().finite().positive().max(20000),
    widthMm: z.coerce.number().finite().positive().max(5000),
  })
  .strict();

const calculatorEdgeSidesSchema = z
  .object({
    front: z.boolean().optional().default(true),
    left: z.boolean().optional().default(false),
    right: z.boolean().optional().default(false),
  })
  .strict();

const calculatorWallSidesSchema = z
  .object({
    back: z.boolean().optional().default(true),
    left: z.boolean().optional().default(false),
    right: z.boolean().optional().default(false),
  })
  .strict();

const calculatorItemV2Schema = z
  .object({
    productType: z.enum(["countertop", "windowsill", "table", "island", "bar"]),
    shape: z.enum(["straight", "l", "u"]),
    tableShape: z.enum(["rectangle", "round", "oval"]).optional().default("rectangle"),
    pieces: z.array(calculatorPieceSchema).min(1).max(3),
    processedEdgeM: z.coerce.number().finite().min(0).max(1000).optional(),
    edgeCode: z.enum(["edge_standard", "edge_round", "edge_reinforced"]).optional().nullable(),
    edgeProfileModel: z.enum(["model_1", "model_2", "model_3", "model_4", "model_5", "model_6", "model_7"]).optional().default("model_1"),
    straightCutM: z.coerce.number().finite().min(0).max(1000).optional(),
    automaticGeometry: z.boolean().optional().default(false),
    polishedSides: z.coerce.number().int().min(1).max(4).optional().default(1),
    roundedCorners: z.coerce.number().int().min(0).max(4).optional().default(0),
    cornerRadiusMm: z.coerce.number().finite().min(0).max(500).optional().default(50),
    installation: z.boolean().optional().default(false),
    backsplash: z.boolean().optional().default(false),
    backsplashType: z.enum(["none", "straight", "coved"]).optional().default("none"),
    backsplashLengthM: z.coerce.number().finite().min(0).max(1000).optional().default(0),
    wallPanel: z.boolean().optional().default(false),
    wallPanelAutoLength: z.boolean().optional().default(true),
    wallPanelLengthM: z.coerce.number().finite().min(0).max(1000).optional().default(0),
    wallPanelHeightMm: z.coerce.number().finite().min(50).max(5000).optional().default(600),
    edgeSides: calculatorEdgeSidesSchema.optional().default({ front: true, left: false, right: false }),
    wallSides: calculatorWallSidesSchema.optional().default({ back: true, left: false, right: false }),
    sinkType: z.enum(["none", "top", "under", "stone"]).optional().default("none"),
    hob: z.boolean().optional().default(false),
    tapHole: z.boolean().optional().default(false),
    socketHoles: z.coerce.number().int().min(0).max(20).optional().default(0),
    dispenserHoles: z.coerce.number().int().min(0).max(20).optional().default(0),
    roundCutouts: z.coerce.number().int().min(0).max(20).optional().default(0),
    otherHoles: z.coerce.number().int().min(0).max(20).optional().default(0),
    measurementRequested: z.boolean().optional().default(false),
    deliveryRequested: z.boolean().optional().default(false),
    liftingRequested: z.boolean().optional().default(false),
    operations: z.array(calculatorOperationSchema).max(100).default([]),
  })
  .strict();

const calculatorAdditionalLineSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    quantity: z.coerce.number().finite().min(0).max(100000),
    unit: z.string().trim().min(1).max(30),
    unitPriceCents: z.coerce.number().int().min(0).max(2000000000),
    currency: z.enum(["BYN", "USD"]),
    category: z.enum(["additional", "logistics", "installation"]).optional(),
    comment: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

const calculatorConfigurationV2Schema = z
  .object({
    items: z.array(calculatorItemV2Schema).min(1).max(20),
    operations: z.array(calculatorOperationSchema).max(200).default([]),
    additionalLines: z.array(calculatorAdditionalLineSchema).max(100).default([]),
    manualSlabCount: z.coerce.number().finite().min(0).max(100).multipleOf(0.5).optional().nullable(),
    manualMaterialPriceUsdCents: z.coerce.number().int().min(0).max(2000000000).optional(),
    materialMarkupBps: z.coerce.number().int().min(0).max(100000).optional(),
    additionalMaterialBynCents: z.coerce.number().int().min(0).max(2000000000).optional(),
    managerAdjustmentBynCents: z.coerce.number().int().min(-2000000000).max(2000000000).optional(),
  })
  .strict();

const calculatorUpdateSchema = z.object({
  version: z.coerce.number().int().positive(),
  total_amount: z.coerce.number().finite().min(0).max(20000000),
  exchange_rate: z.coerce.number().positive().max(999999.9999).nullable(),
  calculator_snapshot: z.union([
    calculatorSnapshotSchema,
    z.object({ schemaVersion: z.literal(2) }).passthrough(),
  ]),
});

const calculatorPreviewSchema = z
  .object({
    materialId: z.string().trim().min(1).max(50),
    materialVariantId: z.coerce.number().int().positive().optional(),
    slabFormatCode: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/),
    customFormat: z
      .object({
        lengthMm: z.coerce.number().finite().positive().max(10000),
        widthMm: z.coerce.number().finite().positive().max(5000),
        thicknessMm: z.coerce.number().finite().positive().max(200),
      })
      .strict()
      .optional(),
    configuration: calculatorConfigurationV2Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.slabFormatCode === "custom" && !value.customFormat) {
      context.addIssue({
        code: "custom",
        path: ["customFormat"],
        message: "Для Custom необходимо указать размеры слэба",
      });
    }
  });

const publicCalculatorLeadSchema = calculatorPreviewSchema.safeExtend({
  contact: z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().trim().min(5).max(30),
      email: z.string().trim().email().max(100).optional().or(z.literal("")),
      comment: z.string().trim().max(1000).optional().nullable(),
    })
    .strict(),
});

const calculatorRateUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    basePriceUsdCents: z.coerce.number().int().min(0).max(2000000000),
    publicAvailable: z.boolean(),
    managerAvailable: z.boolean(),
    manualAdjustmentAllowed: z.boolean(),
    active: z.boolean(),
  })
  .strict();

const calculatorSettingsUpdateSchema = z
  .object({
    exchangeRateScaled: z.coerce.number().int().positive().max(10000000),
    reserveBps: z.coerce.number().int().min(0).max(100000),
    publicFactorBps: z.coerce.number().int().min(0).max(100000),
    minimumOrderBynCents: z.coerce.number().int().min(0).max(2000000000),
    roundingStepBynCents: z.coerce.number().int().positive().max(100000000),
    wasteBps: z.coerce.number().int().min(0).max(100000),
    minimumMaterialMarkupBps: z.coerce.number().int().min(0).max(100000),
    publicWording: z.string().trim().min(1).max(160),
    exchangeRates: z.object({
      USD: z.object({ bynPerUnitScaled: z.coerce.number().int().positive().max(100000000), rateDate: z.string().date().optional().nullable() }),
      EUR: z.object({ bynPerUnitScaled: z.coerce.number().int().positive().max(100000000), rateDate: z.string().date().optional().nullable() }).optional(),
      RUB: z.object({ bynPerUnitScaled: z.coerce.number().int().positive().max(100000000), rateDate: z.string().date().optional().nullable() }).optional(),
    }).optional(),
  })
  .strict();

const calculatorMaterialUpdateSchema = z
  .object({
    category: z.enum(["quartz", "granite", "onyx", "marble"]),
    manufacturer: z.string().trim().max(100).optional().nullable(),
    series: z.string().trim().max(100).optional().nullable(),
    title: z.string().trim().min(1).max(100),
    sku: z.string().trim().max(100).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    image: z.string().trim().max(500).optional().nullable(),
    color: z.string().trim().max(50).optional().nullable(),
    slabFormatId: z.coerce.number().int().positive().optional().nullable(),
    lengthMm: z.coerce.number().int().positive().max(10000).optional().nullable(),
    widthMm: z.coerce.number().int().positive().max(5000).optional().nullable(),
    thicknessMm: z.coerce.number().int().positive().max(200).optional().nullable(),
    priceUnit: z.enum(["slab", "half_slab", "sqm", "manual"]),
    basePriceUsdCents: z.coerce.number().int().min(0).max(2000000000),
    markupBps: z.coerce.number().int().min(0).max(100000),
    active: z.boolean(),
    publicAvailable: z.boolean(),
    sortOrder: z.coerce.number().int().min(-100000).max(100000),
  })
  .strict();

const calculatorMaterialVariantUpdateSchema = z.object({
  active: z.boolean(),
  publicAvailable: z.boolean(),
  publicSortOrder: z.coerce.number().int().min(-100000).max(100000),
}).strict();

const calculatorSlabFormatUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    lengthMm: z.coerce.number().int().positive().max(10000).optional().nullable(),
    widthMm: z.coerce.number().int().positive().max(5000).optional().nullable(),
    thicknessMm: z.coerce.number().int().positive().max(200).optional().nullable(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int().min(-100000).max(100000),
  })
  .strict();

module.exports = {
  orderSchema,
  orderUpdateSchema,
  calculatorUpdateSchema,
  materialSchema,
  servicesSchema,
  statusUpdateSchema,
  loginSchema,
  calculatorPreviewSchema,
  publicCalculatorLeadSchema,
  calculatorRateUpdateSchema,
  calculatorSettingsUpdateSchema,
  calculatorMaterialUpdateSchema,
  calculatorMaterialVariantUpdateSchema,
  calculatorSlabFormatUpdateSchema,
};
