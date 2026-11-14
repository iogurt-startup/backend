import { randomUUID } from 'crypto'
import type { IExamFilesRepository, CreateExamFileDTO, ExamFile } from '../IExamFilesRepository'

export class InMemoryExamFilesRepository implements IExamFilesRepository {
  public items: ExamFile[] = []

  async create(data: CreateExamFileDTO): Promise<ExamFile> {
    const file: ExamFile = {
      id: randomUUID(),
      patientId: data.patientId,
      clinicalRecordId: data.clinicalRecordId ?? null,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      clinicalType: data.clinicalType ?? null,
      uploadedAt: new Date(),
    }
    this.items.push(file)
    return file
  }

  async listByPatient(patientId: string, clinicalType?: string): Promise<ExamFile[]> {
    return this.items
      .filter(f => f.patientId === patientId && (!clinicalType || f.clinicalType === clinicalType))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
  }

  async delete(id: string): Promise<void> {
    const index = this.items.findIndex(f => f.id === id)
    if (index >= 0) {
      this.items.splice(index, 1)
    }
  }
}
