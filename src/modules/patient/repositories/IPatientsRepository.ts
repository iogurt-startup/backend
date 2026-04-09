import type { Patient, Tutor } from '@prisma/client'

export type { Patient }

export type PatientWithTutor = Patient & { tutor: Tutor }

export interface CreatePatientDTO {
  name: string
  tutorId: string
  species: string
  breed?: string
  birthDate?: Date
  sex?: string
  weightKg?: number
  observations?: string
  microchip?: string
  allergies?: string
  photoUrl?: string
}

export interface UpdatePatientDTO {
  name?: string
  species?: string
  breed?: string
  birthDate?: Date
  sex?: string
  weightKg?: number
  observations?: string
  microchip?: string
  allergies?: string
  photoUrl?: string
}

export interface UpdatePatientTutorDTO {
  fullName?: string
  cpf?: string
  phone?: string
  email?: string
  address?: string
  insurance?: string
}

export interface ListPatientsDTO {
  search?: string
  tutorId?: string
  species?: string
  updateDate?: string
  page?: number
  perPage?: number
}

export interface IPatientsRepository {
  create(data: CreatePatientDTO): Promise<Patient>
  findById(id: string): Promise<PatientWithTutor | null>
  update(id: string, data: UpdatePatientDTO): Promise<PatientWithTutor>
  list(params: ListPatientsDTO): Promise<{ patients: PatientWithTutor[]; total: number }>
}
