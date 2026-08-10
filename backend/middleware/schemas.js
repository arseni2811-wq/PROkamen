const { z } = require("zod");

// Схема для создания/обновления заказа
// Все второстепенные поля — optional + nullable: фронтенд может
// прислать null, undefined или не прислать поле вовсе.
// .optional()  → пропускает undefined и отсутствие поля
// .nullable()  → пропускает null
const orderSchema = z.object({
  total_amount: z.number().int().min(0).max(999999999).optional().nullable(),
  prepayment: z.number().int().min(0).max(999999999).optional().nullable(),
  installation_address: z.string().max(500).optional().nullable(),
  deadline_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
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
      full_name: z.string().min(1).max(255).optional().nullable(),
      phone: z.string().max(20).optional().nullable(),
      // email: "" (пустая строка), null и undefined пропускаются;
      // любой введённый текст обязан быть валидным email.
      // .or(z.literal("")) — «либо пустая строка, либо email»
      email: z
        .literal("")
        .or(z.string().trim().email())
        .optional()
        .nullable(),
      address: z.string().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
  client_id: z.number().int().positive().optional().nullable(),
  manager_id: z.number().int().positive().optional().nullable(),
  exchange_rate: z.number().positive().optional().nullable(),
  calculator_snapshot: z.any().optional().nullable(),
  items: z.array(z.any()).optional().nullable(),
});

// Схема для материала
const materialSchema = z.object({
  material_id: z.string().optional(),
  type_id: z.string().nullable().optional(),
  title: z.string().min(1).max(255),
  fabricator: z.string().nullable().optional(),
  price_per_m2: z.number().min(0),
});

// Схема для услуг
const servicesSchema = z.object({
  services: z.record(z.string(), z.number().min(0)).optional(),
});

// Схема для обновления статуса
const statusUpdateSchema = z.object({
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
});

// Схема для логина
const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

module.exports = {
  orderSchema,
  materialSchema,
  servicesSchema,
  statusUpdateSchema,
  loginSchema,
};
