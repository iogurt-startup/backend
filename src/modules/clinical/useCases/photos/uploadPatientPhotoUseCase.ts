import { AppError } from '../../../../shared/errors/app-error'
import type { IPatientPhotosRepository } from '../../repositories/IPatientPhotosRepository'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type { PatientPhoto } from '@prisma/client'

interface UploadPatientPhotoRequest {
  patientId: string
  clinicId: string
  photoUrl: string
  description?: string
  takenAt?: Date
}

export class UploadPatientPhotoUseCase {
  constructor(
    private patientPhotosRepository: IPatientPhotosRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  /**
   * Impede que um usuário de uma clínica manipule fotos de paciente de outra
   * apenas por conhecer o UUID. É chamado antes de gravar o arquivo em disco,
   * para não deixar lixo quando o paciente não pertence à clínica.
   */
  async assertPatientBelongsToClinic(patientId: string, clinicId: string): Promise<void> {
    const patient = await this.patientsRepository.findById(patientId, clinicId)

    if (!patient) {
      throw new AppError('Paciente não encontrado.', 404)
    }
  }

  async execute({
    patientId,
    clinicId,
    photoUrl,
    description,
    takenAt,
  }: UploadPatientPhotoRequest): Promise<PatientPhoto> {
    await this.assertPatientBelongsToClinic(patientId, clinicId)

    if (takenAt && takenAt.getTime() > Date.now()) {
      throw new AppError('A data da foto não pode estar no futuro.', 400)
    }

    return this.patientPhotosRepository.create({
      patientId,
      photoUrl,
      description,
      takenAt,
    })
  }
}
