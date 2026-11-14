import { AppError } from '../../../../shared/errors/app-error'
import type {
  HospitalizationEvolution,
  IHospitalizationsRepository,
} from '../../repositories/IHospitalizationsRepository'

interface AddHospitalizationEvolutionRequest {
  hospitalizationId: string
  clinicId: string
  recordedByVetId: string
  temperature?: number
  heartRate?: number
  respiratoryRate?: number
  mucousMembranes?: string
  notes: string
}

export class AddHospitalizationEvolutionUseCase {
  constructor(private hospitalizationsRepository: IHospitalizationsRepository) {}

  async execute({
    hospitalizationId,
    clinicId,
    recordedByVetId,
    temperature,
    heartRate,
    respiratoryRate,
    mucousMembranes,
    notes,
  }: AddHospitalizationEvolutionRequest): Promise<HospitalizationEvolution> {
    const hospitalization = await this.hospitalizationsRepository.findById(
      hospitalizationId,
      clinicId
    )

    if (!hospitalization) {
      throw new AppError('Internação não encontrada.', 404)
    }

    // Depois da alta a internação é documento fechado: aceitar aferição nova
    // criaria registro clínico fora do período de internação.
    if (hospitalization.status === 'DISCHARGED') {
      throw new AppError(
        'Não é possível registrar evolução em uma internação com alta concedida.',
        400
      )
    }

    const trimmedNotes = notes.trim()
    if (!trimmedNotes) {
      throw new AppError('Descreva a evolução do paciente.', 400)
    }

    const evolution = await this.hospitalizationsRepository.addEvolution({
      hospitalizationId,
      recordedByVetId,
      temperature,
      heartRate,
      respiratoryRate,
      mucousMembranes: mucousMembranes?.trim() || null,
      notes: trimmedNotes,
    })

    // `null` quando a alta entrou entre a checagem e a escrita.
    if (!evolution) {
      throw new AppError(
        'Não é possível registrar evolução em uma internação com alta concedida.',
        400
      )
    }

    return evolution
  }
}
