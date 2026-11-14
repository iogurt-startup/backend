import { AppError } from '../../../../shared/errors/app-error'
import type { IPatientPhotosRepository } from '../../repositories/IPatientPhotosRepository'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type { PatientPhoto } from '@prisma/client'

interface ListPatientPhotosRequest {
  patientId: string
  clinicId: string
}

export class ListPatientPhotosUseCase {
  constructor(
    private patientPhotosRepository: IPatientPhotosRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  async execute({ patientId, clinicId }: ListPatientPhotosRequest): Promise<PatientPhoto[]> {
    // O isolamento por clínica é verificado aqui, e não só na escrita: sem
    // isso, qualquer usuário autenticado conseguiria listar as fotos de um
    // paciente de outra clínica apenas conhecendo o UUID dele.
    const patient = await this.patientsRepository.findById(patientId, clinicId)

    if (!patient) {
      throw new AppError('Paciente não encontrado.', 404)
    }

    return this.patientPhotosRepository.listByPatient(patientId)
  }
}
