import { prisma } from '../../../../config/prisma'
import type { IExamFilesRepository, CreateExamFileDTO, ExamFile } from '../../repositories/IExamFilesRepository'

export class PrismaExamFilesRepository implements IExamFilesRepository {
  async create(data: CreateExamFileDTO): Promise<ExamFile> {
    return prisma.examFile.create({
      data: {
        patientId: data.patientId,
        clinicalRecordId: data.clinicalRecordId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        clinicalType: data.clinicalType ?? null,
      },
    })
  }

  async listByPatient(patientId: string, clinicalType?: string): Promise<ExamFile[]> {
    return prisma.examFile.findMany({
      where: {
        patientId,
        ...(clinicalType ? { clinicalType } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.examFile.delete({ where: { id } })
  }
}
