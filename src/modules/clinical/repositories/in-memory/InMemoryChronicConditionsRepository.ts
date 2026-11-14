import { randomUUID } from 'crypto'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type {
  ChronicCondition,
  CreateChronicConditionDTO,
  IChronicConditionsRepository,
  UpdateChronicConditionDTO,
} from '../IChronicConditionsRepository'

export class InMemoryChronicConditionsRepository implements IChronicConditionsRepository {
  public items: ChronicCondition[] = []

  // O repositório de pacientes aplica clínica + deletedAt, espelhando o filtro do Prisma.
  constructor(private patientsRepository: IPatientsRepository) {}

  async create(data: CreateChronicConditionDTO): Promise<ChronicCondition> {
    const now = new Date()
    const condition: ChronicCondition = {
      id: randomUUID(),
      patientId: data.patientId,
      name: data.name,
      diagnosedAt: data.diagnosedAt ?? null,
      status: data.status,
      observations: data.observations ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.items.push(condition)
    return condition
  }

  async listByPatient(patientId: string): Promise<ChronicCondition[]> {
    return this.items
      .filter(c => c.patientId === patientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async findById(id: string, clinicId: string): Promise<ChronicCondition | null> {
    const condition = this.items.find(c => c.id === id)
    if (!condition) return null

    const patient = await this.patientsRepository.findById(condition.patientId, clinicId)
    return patient ? condition : null
  }

  async update(id: string, data: UpdateChronicConditionDTO): Promise<ChronicCondition> {
    const index = this.items.findIndex(c => c.id === id)
    if (index === -1) throw new Error(`ChronicCondition ${id} not found`)

    const definedEntries = Object.entries(data).filter(([, value]) => value !== undefined)
    this.items[index] = {
      ...this.items[index],
      ...Object.fromEntries(definedEntries),
      updatedAt: new Date(),
    }
    return this.items[index]
  }
}
