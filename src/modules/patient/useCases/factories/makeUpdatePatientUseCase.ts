import { PrismaPatientsRepository } from '../../infra/repositories/PrismaPatientsRepository'
import { PrismaTutorsRepository } from '../../../tutor/infra/repositories/PrismaTutorsRepository'
import { UpdatePatientUseCase } from '../updatePatientUseCase'

export function makeUpdatePatientUseCase() {
  return new UpdatePatientUseCase(
    new PrismaPatientsRepository(),
    new PrismaTutorsRepository(),
  )
}
