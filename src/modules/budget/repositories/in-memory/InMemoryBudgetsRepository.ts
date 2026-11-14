import { randomUUID } from 'crypto'
import type { BudgetStatus } from '@prisma/client'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type { ITutorsRepository } from '../../../tutor/repositories/ITutorsRepository'
import type {
  BudgetItemRecord,
  BudgetRecord,
  CreateBudgetDTO,
  IBudgetsRepository,
  ListBudgetsDTO,
} from '../IBudgetsRepository'

type StoredBudget = Omit<BudgetRecord, 'patient' | 'tutor' | 'items'> & { items: BudgetItemRecord[] }

// Espelha o `include: { items, patient, tutor }` do Prisma, resolvendo os relacionamentos
// pelos repositórios de paciente e tutor (que já aplicam deletedAt e clinicId).
export class InMemoryBudgetsRepository implements IBudgetsRepository {
  public items: StoredBudget[] = []

  constructor(
    private readonly patients: IPatientsRepository,
    private readonly tutors: ITutorsRepository,
  ) {}

  async create(data: CreateBudgetDTO): Promise<BudgetRecord> {
    const id = randomUUID()
    const now = new Date()
    const stored: StoredBudget = {
      id,
      clinicId: data.clinicId,
      patientId: data.patientId,
      tutorId: data.tutorId,
      status: data.status,
      discount: data.discount,
      totalAmount: data.totalAmount,
      notes: data.notes ?? null,
      validUntil: data.validUntil ?? null,
      createdAt: now,
      updatedAt: now,
      items: data.items.map((item) => ({ id: randomUUID(), budgetId: id, ...item })),
    }
    this.items.push(stored)
    return this.hydrate(stored)
  }

  async findById(id: string, clinicId: string): Promise<BudgetRecord | null> {
    const stored = this.items.find((b) => b.id === id && b.clinicId === clinicId)
    return stored ? this.hydrate(stored) : null
  }

  async findManyByClinic({ clinicId, status, search, patientId, from, to, page, limit }: ListBudgetsDTO): Promise<{ budgets: BudgetRecord[]; total: number }> {
    const candidates = this.items.filter(
      (b) =>
        b.clinicId === clinicId
        && (!status || b.status === status)
        && (!patientId || b.patientId === patientId)
        && (!from || b.createdAt >= from)
        && (!to || b.createdAt <= to),
    )
    // Busca por nome exige os relacionamentos; hidrata antes de filtrar e paginar.
    const hydrated = await Promise.all(candidates.map((b) => this.hydrate(b)))
    const term = search?.toLowerCase()
    const matched = hydrated
      .filter((b) => !term || b.patient.name.toLowerCase().includes(term) || b.tutor.fullName.toLowerCase().includes(term))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { budgets: matched.slice((page - 1) * limit, page * limit), total: matched.length }
  }

  async updateStatus(
    id: string,
    clinicId: string,
    expectedStatus: BudgetStatus,
    nextStatus: BudgetStatus,
  ): Promise<BudgetRecord | null> {
    const stored = this.items.find((b) => b.id === id && b.clinicId === clinicId)
    if (!stored || stored.status !== expectedStatus) return null
    stored.status = nextStatus
    stored.updatedAt = new Date()
    return this.hydrate(stored)
  }

  private async hydrate(stored: StoredBudget): Promise<BudgetRecord> {
    const patientWithTutor = await this.patients.findById(stored.patientId, stored.clinicId)
    const tutor = await this.tutors.findById(stored.tutorId, stored.clinicId)
    if (!patientWithTutor || !tutor) {
      throw new Error(`Relacionamento ausente para o orçamento ${stored.id}`)
    }
    const { tutor: _tutor, ...patient } = patientWithTutor
    return {
      ...stored,
      items: stored.items.map((item) => ({ ...item })),
      patient,
      tutor,
    }
  }
}
