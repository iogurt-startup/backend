import { AppError } from '../../../../shared/errors/app-error'
import type {
  Hospitalization,
  IHospitalizationsRepository,
  OpenHospitalizationStatus,
} from '../../repositories/IHospitalizationsRepository'

interface UpdateHospitalizationStatusRequest {
  hospitalizationId: string
  clinicId: string
  status: OpenHospitalizationStatus
}

/**
 * Marca ou desmarca o paciente como crítico durante a internação.
 *
 * A alta não passa por aqui: ela tem caso de uso próprio, porque grava data e
 * orientações. Isto cobre só a transição entre ADMITTED e CRITICAL, que é o
 * que o plantão faz quando o quadro piora ou estabiliza.
 */
export class UpdateHospitalizationStatusUseCase {
  constructor(private hospitalizationsRepository: IHospitalizationsRepository) {}

  async execute({
    hospitalizationId,
    clinicId,
    status,
  }: UpdateHospitalizationStatusRequest): Promise<Hospitalization> {
    const hospitalization = await this.hospitalizationsRepository.findById(
      hospitalizationId,
      clinicId
    )

    if (!hospitalization) {
      throw new AppError('Internação não encontrada.', 404)
    }

    const updated = await this.hospitalizationsRepository.updateStatus(hospitalizationId, status)

    // `null` significa que a internação deixou de estar aberta entre a busca e
    // a escrita — alguém concedeu a alta no meio do caminho.
    if (!updated) {
      throw new AppError(
        'Não é possível alterar o status de uma internação com alta concedida.',
        400
      )
    }

    return updated
  }
}
