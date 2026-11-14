import { AppError } from '../../../../shared/errors/app-error'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type {
  ChronicCondition,
  IChronicConditionsRepository,
} from '../../repositories/IChronicConditionsRepository'

interface ListPatientChronicConditionsRequest {
  patientId: string
  clinicId: string
}

export class ListPatientChronicConditionsUseCase {
  constructor(
    private chronicConditionsRepository: IChronicConditionsRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  async execute({ patientId, clinicId }: ListPatientChronicConditionsRequest): Promise<ChronicCondition[]> {
    const patient = await this.patientsRepository.findById(patientId, clinicId)

    if (!patient) {
      throw new AppError('Paciente não encontrado.', 404)
    }

    return this.chronicConditionsRepository.listByPatient(patientId)
  }
}
