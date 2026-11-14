import { PrismaBudgetsRepository } from '../../infra/repositories/PrismaBudgetsRepository'
import { GetBudgetDetailsUseCase } from '../getBudgetDetailsUseCase'

export function makeGetBudgetDetailsUseCase() {
  return new GetBudgetDetailsUseCase(new PrismaBudgetsRepository())
}
