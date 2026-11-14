import type { ClinicalRecord } from '@prisma/client'

export type { ClinicalRecord }

export interface CreateClinicalRecordDTO {
  patientId: string
  vetId: string
  appointmentId?: string
}

export interface UpdateClinicalRecordDTO {
  weightKg?: number
  clinicalNotes?: string
  diagnosis?: string
  pendingDiagnosis?: string
  prescriptions?: string
  breathingNotes?: string
  routineGuidance?: string
  /** CLI-01 — observações do atendimento, campo próprio (antes ia em routineGuidance). */
  observations?: string
  finalized?: boolean
}

export interface IClinicalRecordsRepository {
  create(data: CreateClinicalRecordDTO): Promise<ClinicalRecord>
  findById(id: string, clinicId: string): Promise<ClinicalRecord | null>
  findByAppointmentId(appointmentId: string): Promise<ClinicalRecord | null>
  update(id: string, data: UpdateClinicalRecordDTO): Promise<ClinicalRecord>
  listByPatient(patientId: string): Promise<ClinicalRecord[]>
}
