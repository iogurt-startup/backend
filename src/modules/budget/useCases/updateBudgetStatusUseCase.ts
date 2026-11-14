import type { BudgetStatus } from '@prisma/client'
import { Errors } from '../../../core/errors'
import type { BudgetRecord, IBudgetsRepository } from '../repositories/IBudgetsRepository'
import { BUDGET_TRANSITIONS } from '../budgetStatus'

export interface UpdateBudgetStatusInput {
  id: string
  clinicId: string
  status: BudgetStatus
}

export class UpdateBudgetStatusUseCase {
  constructor(private budgetsRepository: IBudgetsRepository) {}

  async execute({ id, clinicId, status }: UpdateBudgetStatusInput): Promise<BudgetRecord> {
    const budget = await this.budgetsRepository.findById(id, clinicId)
    if (!budget) throw Errors.notFound('Orçamento não encontrado')

    // Bloqueio pós-aprovação: nenhuma alteração de status após APPROVED.
    if (budget.status === 'APPROVED') {
      throw Errors.conflict('Orçamento aprovado não pode ser alterado.')
    }

    if (status === 'DRAFT') {
      throw Errors.badRequest('Orçamento não pode retornar ao rascunho.')
    }

    if (!BUDGET_TRANSITIONS[budget.status].includes(status)) {
      throw Errors.badRequest(`Transição de ${budget.status} para ${status} não é permitida.`)
    }

    const updated = await this.budgetsRepository.updateStatus(id, clinicId, budget.status, status)
    if (!updated) {
      throw Errors.conflict('O status do orçamento foi alterado por outra requisição. Tente novamente.')
    }
    return updated
  }
}
