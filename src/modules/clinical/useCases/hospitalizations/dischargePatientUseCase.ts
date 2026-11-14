import { AppError } from '../../../../shared/errors/app-error'
import type {
  Hospitalization,
  IHospitalizationsRepository,
} from '../../repositories/IHospitalizationsRepository'

interface DischargePatientRequest {
  hospitalizationId: string
  clinicId: string
  dischargeNotes?: string
  now?: Date
}

export class DischargePatientUseCase {
  constructor(private hospitalizationsRepository: IHospitalizationsRepository) {}

  async execute({
    hospitalizationId,
    clinicId,
    dischargeNotes,
    now = new Date(),
  }: DischargePatientRequest): Promise<Hospitalization> {
    const hospitalization = await this.hospitalizationsRepository.findById(
      hospitalizationId,
      clinicId
    )

    if (!hospitalization) {
      throw new AppError('Internação não encontrada.', 404)
    }

    // Alta repetida sobrescreveria a data da alta original.
    if (hospitalization.status === 'DISCHARGED') {
      throw new AppError('Esta internação já teve alta concedida.', 400)
    }

    const discharged = await this.hospitalizationsRepository.discharge(hospitalizationId, {
      dischargedAt: now,
      dischargeNotes: dischargeNotes?.trim() || null,
    })

    // `null` quando outra requisição concedeu a alta entre a busca e a
    // escrita. A condição é avaliada pelo banco, então duas altas simultâneas
    // não sobrescrevem a data da primeira.
    if (!discharged) {
      throw new AppError('Esta internação já teve alta concedida.', 400)
    }

    return discharged
  }
}
