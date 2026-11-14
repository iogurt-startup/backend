import { PrismaBudgetsRepository } from '../../infra/repositories/PrismaBudgetsRepository'
import { PrismaPatientsRepository } from '../../../patient/infra/repositories/PrismaPatientsRepository'
import { PrismaTutorsRepository } from '../../../tutor/infra/repositories/PrismaTutorsRepository'
import { CreateBudgetUseCase } from '../createBudgetUseCase'

export function makeCreateBudgetUseCase() {
  return new CreateBudgetUseCase(
    new PrismaBudgetsRepository(),
    new PrismaPatientsRepository(),
    new PrismaTutorsRepository(),
  )
}
