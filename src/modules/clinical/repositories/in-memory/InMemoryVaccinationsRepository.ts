import { randomUUID } from 'crypto'
import type {
  IVaccinationsRepository,
  CreateVaccinationDTO,
  Vaccination,
  VaccinationStatus,
  ListVaccinationAlertsFilters,
} from '../IVaccinationsRepository'
import {
  classifyVaccinationAlerts,
  type VaccinationAlertItem,
  type VaccinationRecordWithRelations,
} from '../../vaccinationAlerts'

export interface InMemoryVaccinationPatientData {
  id: string
  name: string
  species: string
  clinicId: string
  deletedAt?: Date | null
  tutor: {
    id: string
    fullName: string
    phone: string
  }
}

export class InMemoryVaccinationsRepository implements IVaccinationsRepository {
  public items: Vaccination[] = []
  public patientsMap: Map<string, InMemoryVaccinationPatientData> = new Map()

  setPatient(patient: InMemoryVaccinationPatientData) {
    this.patientsMap.set(patient.id, patient)
  }

  async create(data: CreateVaccinationDTO): Promise<Vaccination> {
    const vaccination: Vaccination = {
      id: randomUUID(),
      patientId: data.patientId,
      vaccineName: data.vaccineName,
      appliedAt: data.appliedAt ?? null,
      nextDoseAt: data.nextDoseAt ?? null,
      doseNumber: data.doseNumber ?? null,
      intervalDays: data.intervalDays ?? null,
      status: data.status,
      createdAt: new Date(),
    }
    this.items.push(vaccination)
    return vaccination
  }

  async listByPatient(patientId: string): Promise<Vaccination[]> {
    return this.items
      .filter((v) => v.patientId === patientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async findById(id: string, clinicId: string): Promise<Vaccination | null> {
    const item = this.items.find((v) => v.id === id)
    if (!item) return null

    const patient = this.patientsMap.get(item.patientId)
    if (patient && patient.clinicId !== clinicId) return null

    return item
  }

  async updateStatus(id: string, status: VaccinationStatus): Promise<Vaccination> {
    const index = this.items.findIndex((v) => v.id === id)
    this.items[index].status = status
    return this.items[index]
  }

  async findAlertsByClinic(
    clinicId: string,
    filters?: ListVaccinationAlertsFilters
  ): Promise<VaccinationAlertItem[]> {
    const recordsWithRelations: VaccinationRecordWithRelations[] = []

    for (const item of this.items) {
      const patient = this.patientsMap.get(item.patientId) ?? {
        id: item.patientId,
        name: 'Pet Padrão',
        species: 'CANINE',
        clinicId,
        deletedAt: null,
        tutor: {
          id: 'tutor-default',
          fullName: 'Tutor Padrão',
          phone: '11999999999',
        },
      }

      if (patient.clinicId !== clinicId || patient.deletedAt) {
        continue
      }

      recordsWithRelations.push({
        ...item,
        patient,
      })
    }

    return classifyVaccinationAlerts(recordsWithRelations, filters)
  }
}
