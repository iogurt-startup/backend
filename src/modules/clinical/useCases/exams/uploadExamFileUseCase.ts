import { AppError } from '../../../../shared/errors/app-error'
import type { IExamFilesRepository } from '../../repositories/IExamFilesRepository'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type { ExamFile } from '@prisma/client'

interface UploadExamFileRequest {
  patientId: string
  clinicId: string
  clinicalRecordId?: string
  fileName: string
  fileUrl: string
  fileType: string
  clinicalType?: string | null
}

export class UploadExamFileUseCase {
  constructor(
    private examFilesRepository: IExamFilesRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  async assertPatientBelongsToClinic(patientId: string, clinicId: string): Promise<void> {
    const patient = await this.patientsRepository.findById(patientId, clinicId)

    if (!patient) {
      throw new AppError('Paciente não encontrado.', 404)
    }
  }

  async execute({
    patientId,
    clinicId,
    clinicalRecordId,
    fileName,
    fileUrl,
    fileType,
    clinicalType,
  }: UploadExamFileRequest): Promise<ExamFile> {
    await this.assertPatientBelongsToClinic(patientId, clinicId)

    return this.examFilesRepository.create({
      patientId,
      clinicalRecordId,
      fileName,
      fileUrl,
      fileType,
      clinicalType,
    })
  }
}
