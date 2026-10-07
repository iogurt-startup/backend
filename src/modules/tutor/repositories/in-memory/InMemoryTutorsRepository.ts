import { randomUUID } from 'crypto'
import type { Tutor } from '@prisma/client'
import type {
  ITutorsRepository,
  CreateTutorDTO,
  UpdateTutorDTO,
  ListTutorsDTO,
} from '../ITutorsRepository'

export class InMemoryTutorsRepository implements ITutorsRepository {
  public items: Tutor[] = []

  // Espelha o filtro `deletedAt: null` do repositório Prisma (BE-02)
  private get active(): Tutor[] {
    return this.items.filter(t => t.deletedAt === null)
  }

  async create(data: CreateTutorDTO): Promise<Tutor> {
    const tutor: Tutor = {
      id: randomUUID(),
      userId: null,
      clinicId: data.clinicId,
      fullName: data.fullName,
      cpf: data.cpf,
      phone: data.phone,
      email: data.email ?? null,
      address: data.address ?? null,
      insurance: data.insurance ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }
    this.items.push(tutor)
    return tutor
  }

  async findById(id: string, clinicId: string): Promise<Tutor | null> {
    return this.active.find(t => t.id === id && t.clinicId === clinicId) ?? null
  }

  async findByCpf(cpf: string, clinicId: string): Promise<Tutor | null> {
    return this.active.find(t => t.cpf === cpf && t.clinicId === clinicId) ?? null
  }

  async findByEmail(email: string, clinicId: string): Promise<Tutor | null> {
    return this.active.find(t => t.email === email && t.clinicId === clinicId) ?? null
  }

  async list({ clinicId, search, page = 1, perPage = 20 }: ListTutorsDTO): Promise<{ tutors: Tutor[]; total: number }> {
    let tutors = this.active.filter(t => t.clinicId === clinicId)
    if (search) {
      tutors = tutors.filter(t => t.fullName.toLowerCase().includes(search.toLowerCase()))
    }
    const total = tutors.length
    tutors = tutors.slice((page - 1) * perPage, page * perPage)
    return { tutors, total }
  }

  async update(id: string, data: UpdateTutorDTO): Promise<Tutor> {
    const index = this.items.findIndex(t => t.id === id)
    this.items[index] = { ...this.items[index], ...data, updatedAt: new Date() }
    return this.items[index]
  }

  async softDelete(id: string): Promise<void> {
    const index = this.items.findIndex(t => t.id === id)
    if (index === -1) return
    this.items[index] = { ...this.items[index], deletedAt: new Date(), updatedAt: new Date() }
  }
}
