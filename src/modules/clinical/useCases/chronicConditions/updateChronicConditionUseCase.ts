import { AppError } from '../../../../shared/errors/app-error'
import type {
  ChronicCondition,
  ChronicConditionStatus,
  IChronicConditionsRepository,
  UpdateChronicConditionDTO,
} from '../../repositories/IChronicConditionsRepository'
import { parseDiagnosisDate } from './diagnosisDate'

interface UpdateChronicConditionRequest {
  id: string
  clinicId: string
  name?: string
  diagnosedAt?: string | Date | null
  status?: ChronicConditionStatus
  observations?: string | null
}

export class UpdateChronicConditionUseCase {
  constructor(private chronicConditionsRepository: IChronicConditionsRepository) {}

  async execute({ id, clinicId, ...fields }: UpdateChronicConditionRequest): Promise<ChronicCondition> {
    const condition = await this.chronicConditionsRepository.findById(id, clinicId)

    if (!condition) {
      throw new AppError('Patologia não encontrada.', 404)
    }

    const data: UpdateChronicConditionDTO = {}

    if (fields.name !== undefined) {
      const trimmedName = fields.name.trim()
      if (trimmedName.length < 2) {
        throw new AppError('O nome da patologia deve ter ao menos 2 caracteres.', 400)
      }
      data.name = trimmedName
    }
    if (fields.diagnosedAt !== undefined) {
      data.diagnosedAt = fields.diagnosedAt === null ? null : parseDiagnosisDate(fields.diagnosedAt)
    }
    if (fields.status !== undefined) data.status = fields.status
    if (fields.observations !== undefined) data.observations = fields.observations

    if (Object.keys(data).length === 0) {
      throw new AppError('Informe ao menos um campo para atualizar.', 400)
    }

    return this.chronicConditionsRepository.update(id, data)
  }
}
