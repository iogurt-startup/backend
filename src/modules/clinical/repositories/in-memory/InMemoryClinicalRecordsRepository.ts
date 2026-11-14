import { randomUUID } from 'crypto'
import type { ClinicalRecord } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type {
  IClinicalRecordsRepository,
  CreateClinicalRecordDTO,
  UpdateClinicalRecordDTO,
} from '../IClinicalRecordsRepository'

export class InMemoryClinicalRecordsRepository implements IClinicalRecordsRepository {
  public items: ClinicalRecord[] = []

  async create(data: CreateClinicalRecordDTO): Promise<ClinicalRecord> {
    const record: ClinicalRecord = {
      id: randomUUID(),
      patientId: data.patientId,
      vetId: data.vetId,
      appointmentId: data.appointmentId ?? null,
      weightKg: null,
      clinicalNotes: null,
      diagnosis: null,
      pendingDiagnosis: null,
      prescriptions: null,
      breathingNotes: null,
      routineGuidance: null,
      aiSummary: null,
      observations: null,
      finalized: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.items.push(record)
    return record
  }

  async findById(id: string, clinicId: string): Promise<ClinicalRecord | null> {
    return this.items.find(i => i.id === id) ?? null
  }

  async findByAppointmentId(appointmentId: string): Promise<ClinicalRecord | null> {
    return this.items.find(i => i.appointmentId === appointmentId) ?? null
  }

  async update(id: string, data: UpdateClinicalRecordDTO): Promise<ClinicalRecord> {
    const index = this.items.findIndex(i => i.id === id)
    if (data.weightKg !== undefined) {
      if (data.weightKg === null) {
        this.items[index].weightKg = null
      } else {
        this.items[index].weightKg = new Decimal(data.weightKg)
      }
    }
    const { weightKg, ...rest } = data
    this.items[index] = { ...this.items[index], ...rest, updatedAt: new Date() }
    return this.items[index]
  }

  async listByPatient(patientId: string): Promise<ClinicalRecord[]> {
    return this.items.filter(i => i.patientId === patientId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
