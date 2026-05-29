import { z } from "zod";

export const createTransactionSchema = z.object({
  concept: z.string().min(1, "Concepto requerido").max(200),
  amount: z.union([z.number(), z.string()]).pipe(
    z.coerce.number().refine((n) => !isNaN(n) && n !== 0, "Amount debe ser un número válido distinto de cero")
  ),
  bank_id: z.string().min(1, "Banco requerido"),
  account_id: z.string().optional(),
  group: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
  is_recurring: z.boolean().optional().default(false),
  recurring_period: z.enum(["diario", "semanal", "mensual", "anual"]).nullable().optional(),
  timestamp: z.string().datetime().optional(),
  comentarios: z.string().max(500).optional(),
});

export const updateTransactionSchema = z.object({
  concept: z.string().min(1).max(200).optional(),
  amount: z.union([z.number(), z.string()]).pipe(
    z.coerce.number().refine((n) => !isNaN(n), "Amount inválido")
  ).optional(),
  bank_id: z.string().optional(),
  account_id: z.string().nullable().optional(),
  group: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
  timestamp: z.string().datetime().optional(),
  comentarios: z.string().max(500).optional(),
});

export const createBankSchema = z.object({
  bank_name: z.string().min(1, "Nombre requerido").max(100),
  account_label: z.string().max(100).optional(),
  iban: z.string().optional(),
  balance: z.number().optional().default(0),
});

export const createTransferSchema = z.object({
  from_account_id: z.string().min(1, "Cuenta origen requerida"),
  to_account_id: z.string().min(1, "Cuenta destino requerida"),
  amount: z.union([z.number(), z.string()]).pipe(
    z.coerce.number().refine((n) => !isNaN(n) && n > 0, "Amount debe ser > 0")
  ),
  concept: z.string().max(200).optional(),
  timestamp: z.string().datetime().optional(),
  is_scheduled: z.boolean().optional(),
  frequency: z.enum(["diario", "semanal", "mensual", "anual"]).optional(),
  end_date: z.string().datetime().optional(),
});

export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type CreateBank = z.infer<typeof createBankSchema>;
export type CreateTransfer = z.infer<typeof createTransferSchema>;
