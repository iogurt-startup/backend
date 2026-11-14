import { PrismaBudgetsRepository } from '../../infra/repositories/PrismaBudgetsRepository'
import { UpdateBudgetStatusUseCase } from '../updateBudgetStatusUseCase'

export function makeUpdateBudgetStatusUseCase() {
  return new UpdateBudgetStatusUseCase(new PrismaBudgetsRepository())
}
