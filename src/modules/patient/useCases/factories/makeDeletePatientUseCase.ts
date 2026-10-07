import { PrismaPatientsRepository } from '../../infra/repositories/PrismaPatientsRepository'
import { DeletePatientUseCase } from '../deletePatientUseCase'

export function makeDeletePatientUseCase() {
  return new DeletePatientUseCase(new PrismaPatientsRepository())
}

