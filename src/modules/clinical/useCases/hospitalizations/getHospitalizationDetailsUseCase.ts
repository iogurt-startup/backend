import { AppError } from '../../../../shared/errors/app-error'
import type {
  HospitalizationDetails,
  IHospitalizationsRepository,
} from '../../repositories/IHospitalizationsRepository'

interface GetHospitalizationDetailsRequest {
  hospitalizationId: string
  clinicId: string
}

export class GetHospitalizationDetailsUseCase {
  constructor(private hospitalizationsRepository: IHospitalizationsRepository) {}

  async execute({
    hospitalizationId,
    clinicId,
  }: GetHospitalizationDetailsRequest): Promise<HospitalizationDetails> {
    // A busca é escopada por clínica. Sem isso, qualquer usuário autenticado
    // leria a internação de outra clínica só com o UUID.
    const hospitalization = await this.hospitalizationsRepository.findDetailsById(
      hospitalizationId,
      clinicId
    )

    if (!hospitalization) {
      throw new AppError('Internação não encontrada.', 404)
    }

    return hospitalization
  }
}
