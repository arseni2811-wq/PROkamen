const { z } = require("zod");

// Схема для создания/обновления заказа
const orderSchema = z.object({
  total_amount: z.number().int().min(0).max(999999999).optional(),
  prepayment: z.number().int().min(0).max(999999999).optional(),
  installation_address: z.string().max(500).nullable().optional(),
  deadline_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
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
    .optional(),
  client: z
    .object({
      full_name: z.string().min(1).max(255).optional(),
      phone: z.string().max(20).optional(),
      email: z.string().email().optional(),
      address: z.string().max(500).optional(),
    })
    .optional(),
  client_id: z.number().int().positive().optional(),
  manager_id: z.number().int().positive().optional(),
  exchange_rate: z.number().positive().optional(),
  calculator_snapshot: z.any().optional(),
  items: z.array(z.any()).optional(),
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
