import { PrismaPatientsRepository } from '../../../patient/infra/repositories/PrismaPatientsRepository'
import { PrismaChronicConditionsRepository } from '../../infra/repositories/PrismaChronicConditionsRepository'
import { CreateChronicConditionUseCase } from '../chronicConditions/createChronicConditionUseCase'
import { ListPatientChronicConditionsUseCase } from '../chronicConditions/listPatientChronicConditionsUseCase'
import { UpdateChronicConditionUseCase } from '../chronicConditions/updateChronicConditionUseCase'

export function makeCreateChronicConditionUseCase() {
  return new CreateChronicConditionUseCase(
    new PrismaChronicConditionsRepository(),
    new PrismaPatientsRepository()
  )
}

export function makeListPatientChronicConditionsUseCase() {
  return new ListPatientChronicConditionsUseCase(
    new PrismaChronicConditionsRepository(),
    new PrismaPatientsRepository()
  )
}

export function makeUpdateChronicConditionUseCase() {
  return new UpdateChronicConditionUseCase(new PrismaChronicConditionsRepository())
}
