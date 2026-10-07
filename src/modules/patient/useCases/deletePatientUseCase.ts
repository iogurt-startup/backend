import { Errors } from '../../../core/errors'
import type { IPatientsRepository } from '../repositories/IPatientsRepository'

interface DeletePatientInput {
  id: string
  clinicId: string
}

export class DeletePatientUseCase {
  constructor(private patientsRepository: IPatientsRepository) {}

  async execute({ id, clinicId }: DeletePatientInput): Promise<void> {
    const patient = await this.patientsRepository.findById(id, clinicId)
    if (!patient) throw Errors.notFound('Paciente não encontrado')

    await this.patientsRepository.softDelete(id)
  }
}

