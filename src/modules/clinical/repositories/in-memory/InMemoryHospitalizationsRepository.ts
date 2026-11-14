import { randomUUID } from 'crypto'
import type {
  CreateHospitalizationDTO,
  CreateHospitalizationEvolutionDTO,
  DischargeHospitalizationDTO,
  Hospitalization,
  HospitalizationDetails,
  HospitalizationEvolution,
  HospitalizationWithPatient,
  IHospitalizationsRepository,
  OpenHospitalizationStatus,
} from '../IHospitalizationsRepository'
import {
  OPEN_HOSPITALIZATION_STATUSES,
  OpenHospitalizationConflictError,
} from '../IHospitalizationsRepository'

export class InMemoryHospitalizationsRepository implements IHospitalizationsRepository {
  public items: Hospitalization[] = []
  public evolutions: HospitalizationEvolution[] = []

  private isOpen(hospitalization: Hospitalization): boolean {
    return OPEN_HOSPITALIZATION_STATUSES.includes(
      hospitalization.status as OpenHospitalizationStatus
    )
  }

  async create(data: CreateHospitalizationDTO): Promise<Hospitalization> {
    // Espelha o índice único parcial do banco, para o in-memory não aceitar o
    // que o Postgres recusaria.
    if (await this.findOpenByPatient(data.patientId)) {
      throw new OpenHospitalizationConflictError()
    }

    const now = new Date()
    const hospitalization: Hospitalization = {
      id: randomUUID(),
      clinicId: data.clinicId,
      patientId: data.patientId,
      admittedByVetId: data.admittedByVetId,
      bedIdentifier: data.bedIdentifier,
      reason: data.reason,
      status: data.status ?? 'ADMITTED',
      admittedAt: now,
      dischargedAt: null,
      dischargeNotes: null,
      createdAt: now,
      updatedAt: now,
    }
    this.items.push(hospitalization)
    return hospitalization
  }

  async findOpenByPatient(patientId: string): Promise<Hospitalization | null> {
    return (
      this.items.find(item => item.patientId === patientId && this.isOpen(item)) ?? null
    )
  }

  async findById(id: string, clinicId: string): Promise<Hospitalization | null> {
    return this.items.find(item => item.id === id && item.clinicId === clinicId) ?? null
  }

  async findDetailsById(id: string, clinicId: string): Promise<HospitalizationDetails | null> {
    const hospitalization = await this.findById(id, clinicId)
    if (!hospitalization) return null

    return {
      ...hospitalization,
      evolutions: this.evolutions
        .filter(evolution => evolution.hospitalizationId === id)
        // Ordem cronológica crescente: a timeline conta a história do dia.
        .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()),
    }
  }

  async listActiveByClinic(clinicId: string): Promise<HospitalizationWithPatient[]> {
    return this.items
      .filter(item => item.clinicId === clinicId && this.isOpen(item))
      // Só ordem cronológica, igual ao Prisma. A prioridade por criticidade
      // é aplicada no caso de uso, para os dois repositórios concordarem.
      .sort((a, b) => a.admittedAt.getTime() - b.admittedAt.getTime())
  }

  async discharge(
    id: string,
    data: DischargeHospitalizationDTO
  ): Promise<Hospitalization | null> {
    const index = this.items.findIndex(item => item.id === id && this.isOpen(item))
    if (index < 0) return null

    this.items[index] = {
      ...this.items[index],
      status: 'DISCHARGED',
      dischargedAt: data.dischargedAt,
      dischargeNotes: data.dischargeNotes ?? null,
      updatedAt: new Date(),
    }
    return this.items[index]
  }

  async updateStatus(
    id: string,
    status: OpenHospitalizationStatus
  ): Promise<Hospitalization | null> {
    const index = this.items.findIndex(item => item.id === id && this.isOpen(item))
    if (index < 0) return null

    this.items[index] = { ...this.items[index], status, updatedAt: new Date() }
    return this.items[index]
  }

  async addEvolution(
    data: CreateHospitalizationEvolutionDTO
  ): Promise<HospitalizationEvolution | null> {
    const hospitalization = this.items.find(item => item.id === data.hospitalizationId)
    if (!hospitalization || !this.isOpen(hospitalization)) return null

    const evolution: HospitalizationEvolution = {
      id: randomUUID(),
      hospitalizationId: data.hospitalizationId,
      recordedByVetId: data.recordedByVetId,
      temperature: data.temperature ?? null,
      heartRate: data.heartRate ?? null,
      respiratoryRate: data.respiratoryRate ?? null,
      mucousMembranes: data.mucousMembranes ?? null,
      notes: data.notes,
      recordedAt: new Date(),
    }
    this.evolutions.push(evolution)
    return evolution
  }
}
