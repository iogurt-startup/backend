import type { BudgetStatus } from '@prisma/client'

export const BUDGET_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const satisfies readonly BudgetStatus[]

export const BUDGET_INITIAL_STATUSES = ['DRAFT', 'PENDING'] as const satisfies readonly BudgetStatus[]

export type InitialBudgetStatus = (typeof BUDGET_INITIAL_STATUSES)[number]

// Máquina de estados do fluxo comercial. APPROVED e estados terminais não têm saída.
// DRAFT nunca é alvo de transição (ver UpdateBudgetStatusUseCase).
export const BUDGET_TRANSITIONS: Record<BudgetStatus, readonly BudgetStatus[]> = {
  DRAFT: ['PENDING', 'EXPIRED'],
  PENDING: ['APPROVED', 'REJECTED', 'EXPIRED'],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
}
