import type { BudgetRecord, IBudgetsRepository, ListBudgetsDTO } from '../repositories/IBudgetsRepository'

export class ListClinicBudgetsUseCase {
  constructor(private budgetsRepository: IBudgetsRepository) {}

  async execute(params: ListBudgetsDTO): Promise<{ budgets: BudgetRecord[]; total: number }> {
    return this.budgetsRepository.findManyByClinic(params)
  }
}
