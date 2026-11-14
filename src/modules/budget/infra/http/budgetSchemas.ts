import { z } from 'zod'
import { BUDGET_INITIAL_STATUSES, BUDGET_STATUSES } from '../../budgetStatus'

// Validação de formato (Zod → 422). Regras de negócio (quantidade > 0, preço >= 0,
// desconto dentro do intervalo) são aplicadas no use case e retornam 400.
export const clinicBudgetsParamsSchema = z.object({
  clinicId: z.string().uuid(),
})

export const budgetParamsSchema = z.object({
  clinicId: z.string().uuid(),
  id: z.string().uuid(),
})

export const createBudgetBodySchema = z.object({
  patientId: z.string().uuid(),
  tutorId: z.string().uuid(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(255),
        quantity: z.number(),
        unitPrice: z.number(),
      }),
    )
    .min(1),
  discount: z.number().optional(),
  notes: z.string().trim().max(2000).optional(),
  validUntil: z.coerce.date().optional(),
  status: z.enum(BUDGET_INITIAL_STATUSES).optional(),
})

export const listBudgetsQuerySchema = z
  .object({
    status: z.enum(BUDGET_STATUSES).optional(),
    search: z.string().trim().min(2).max(100).optional(),
    patientId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'A data inicial não pode ser posterior à data final.',
    path: ['from'],
  })

export const updateBudgetStatusBodySchema = z.object({
  status: z.enum(BUDGET_STATUSES),
})

export type ClinicBudgetsParams = z.infer<typeof clinicBudgetsParamsSchema>
export type BudgetParams = z.infer<typeof budgetParamsSchema>
export type CreateBudgetBody = z.infer<typeof createBudgetBodySchema>
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>
export type UpdateBudgetStatusBody = z.infer<typeof updateBudgetStatusBodySchema>
