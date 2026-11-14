import { AppError } from '../../../../shared/errors/app-error'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type {
  ChronicCondition,
  ChronicConditionStatus,
  IChronicConditionsRepository,
} from '../../repositories/IChronicConditionsRepository'
import { parseDiagnosisDate } from './diagnosisDate'

interface CreateChronicConditionRequest {
  patientId: string
  clinicId: string
  name: string
  diagnosedAt?: string | Date
  status?: ChronicConditionStatus
  observations?: string
}

export class CreateChronicConditionUseCase {
  constructor(
    private chronicConditionsRepository: IChronicConditionsRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  async execute({
    patientId,
    clinicId,
    name,
    diagnosedAt,
    status = 'ACTIVE',
    observations,
  }: CreateChronicConditionRequest): Promise<ChronicCondition> {
    const patient = await this.patientsRepository.findById(patientId, clinicId)

    if (!patient) {
      throw new AppError('Paciente não encontrado.', 404)
    }

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      throw new AppError('O nome da patologia deve ter ao menos 2 caracteres.', 400)
    }

    return this.chronicConditionsRepository.create({
      patientId,
      name: trimmedName,
      status,
      diagnosedAt: diagnosedAt ? parseDiagnosisDate(diagnosedAt) : undefined,
      observations,
    })
  }
}
