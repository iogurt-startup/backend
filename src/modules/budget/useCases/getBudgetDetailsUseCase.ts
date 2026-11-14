import { Errors } from '../../../core/errors'
import type { BudgetRecord, IBudgetsRepository } from '../repositories/IBudgetsRepository'

export class GetBudgetDetailsUseCase {
  constructor(private budgetsRepository: IBudgetsRepository) {}

  async execute({ id, clinicId }: { id: string; clinicId: string }): Promise<BudgetRecord> {
    const budget = await this.budgetsRepository.findById(id, clinicId)
    if (!budget) throw Errors.notFound('Orçamento não encontrado')
    return budget
  }
}
