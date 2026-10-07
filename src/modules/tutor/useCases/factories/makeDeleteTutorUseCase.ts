import { PrismaTutorsRepository } from '../../infra/repositories/PrismaTutorsRepository'
import { PrismaPatientsRepository } from '../../../patient/infra/repositories/PrismaPatientsRepository'
import { DeleteTutorUseCase } from '../deleteTutorUseCase'

export function makeDeleteTutorUseCase() {
  const tutorsRepository = new PrismaTutorsRepository()
  const patientsRepository = new PrismaPatientsRepository()
  return new DeleteTutorUseCase(tutorsRepository, patientsRepository)
}

