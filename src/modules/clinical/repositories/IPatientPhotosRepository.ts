import type { PatientPhoto } from '@prisma/client'

export type { PatientPhoto }

export interface CreatePatientPhotoDTO {
  patientId: string
  photoUrl: string
  description?: string
  takenAt?: Date
}

export interface IPatientPhotosRepository {
  create(data: CreatePatientPhotoDTO): Promise<PatientPhoto>
  listByPatient(patientId: string): Promise<PatientPhoto[]>
  findById(id: string): Promise<PatientPhoto | null>
  delete(id: string): Promise<void>
}
