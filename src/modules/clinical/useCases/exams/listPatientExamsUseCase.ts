import { AppError } from '../../../../shared/errors/app-error'
import type { IExamFilesRepository } from '../../repositories/IExamFilesRepository'
import type { ExamFile } from '@prisma/client'

interface ListPatientExamsRequest {
  patientId: string
  clinicalType?: string
}

export class ListPatientExamsUseCase {
  constructor(private examFilesRepository: IExamFilesRepository) {}

  async execute({ patientId, clinicalType }: ListPatientExamsRequest): Promise<ExamFile[]> {
    return this.examFilesRepository.listByPatient(patientId, clinicalType)
  }
}
