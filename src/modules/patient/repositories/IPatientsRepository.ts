import type { Patient, Tutor } from '@prisma/client'
import type { PatientSex, PatientSpecies, ReproductiveCondition } from '../patientFields'

export type { Patient }

export type PatientWithTutor = Patient & { tutor: Tutor }

export interface CreatePatientDTO {
  name: string
  tutorId: string
  clinicId: string
  species: PatientSpecies
  breed?: string
  birthDate?: Date
  sex: PatientSex
  reproductiveCondition?: ReproductiveCondition
  coatDescription?: string
  weightKg?: number
  observations?: string
  microchip?: string
  allergies?: string
  photoUrl?: string
}

export interface UpdatePatientDTO {
  name?: string
  species?: PatientSpecies
  breed?: string
  birthDate?: Date
  sex?: PatientSex
  reproductiveCondition?: ReproductiveCondition | null
  coatDescription?: string | null
  weightKg?: number
  observations?: string
  microchip?: string
  allergies?: string
  photoUrl?: string
}

export interface ListPatientsDTO {
  clinicId: string
  search?: string
  tutorId?: string
  species?: string
  updateDate?: string
  page?: number
  perPage?: number
}

// Todos os métodos de busca/listagem consideram apenas pacientes ativos (deletedAt = null) — BE-02
export interface IPatientsRepository {
  create(data: CreatePatientDTO): Promise<Patient>
  findById(id: string, clinicId: string): Promise<PatientWithTutor | null>
  update(id: string, data: UpdatePatientDTO): Promise<Patient>
  list(params: ListPatientsDTO): Promise<{ patients: PatientWithTutor[]; total: number }>
  softDelete(id: string): Promise<void>
}
