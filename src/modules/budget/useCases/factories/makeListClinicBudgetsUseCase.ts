import { PrismaBudgetsRepository } from '../../infra/repositories/PrismaBudgetsRepository'
import { ListClinicBudgetsUseCase } from '../listClinicBudgetsUseCase'

export function makeListClinicBudgetsUseCase() {
  return new ListClinicBudgetsUseCase(new PrismaBudgetsRepository())
}
