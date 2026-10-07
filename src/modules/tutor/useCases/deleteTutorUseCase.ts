import { Errors } from '../../../core/errors'
import type { ITutorsRepository } from '../repositories/ITutorsRepository'
import type { IPatientsRepository } from '../../patient/repositories/IPatientsRepository'

interface DeleteTutorInput {
  id: string
  clinicId: string
}

export class DeleteTutorUseCase {
  constructor(
    private tutorsRepository: ITutorsRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  async execute({ id, clinicId }: DeleteTutorInput): Promise<void> {
    const tutor = await this.tutorsRepository.findById(id, clinicId)
    if (!tutor) {
      throw Errors.notFound('Tutor não encontrado')
    }

    const { total } = await this.patientsRepository.list({ clinicId, tutorId: id })
    if (total > 0) {
      throw Errors.conflict('Não é possível excluir um tutor que possui pacientes ativos.')
    }

    await this.tutorsRepository.softDelete(id)
  }
}

