import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import type { Patient, Tutor } from '@prisma/client'
import type {
  IPatientsRepository,
  CreatePatientDTO,
  UpdatePatientDTO,
  ListPatientsDTO,
  PatientWithTutor,
} from '../IPatientsRepository'

const dummyTutor: Tutor = {
  id: '',
  userId: null,
  clinicId: 'clinic-1',
  fullName: 'Tutor',
  cpf: '52998224725',
  phone: '',
  email: null,
  address: null,
  insurance: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

export class InMemoryPatientsRepository implements IPatientsRepository {
  public items: PatientWithTutor[] = []

  // Espelha o filtro `deletedAt: null` do repositório Prisma (BE-02)
  private get active(): PatientWithTutor[] {
    return this.items.filter(p => p.deletedAt === null)
  }

  async create(data: CreatePatientDTO): Promise<Patient> {
    const patient: PatientWithTutor = {
      id: randomUUID(),
      name: data.name,
      species: data.species,
      breed: data.breed ?? null,
      birthDate: data.birthDate ?? null,
      sex: data.sex ?? null,
      weightKg: data.weightKg != null ? data.weightKg as any : null,
      observations: data.observations ?? null,
      microchip: data.microchip ?? null,
      allergies: data.allergies ?? null,
      photoUrl: data.photoUrl ?? null,
      tutorId: data.tutorId,
      clinicId: data.clinicId,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      tutor: { ...dummyTutor, id: data.tutorId, clinicId: data.clinicId },
    }
    this.items.push(patient)
    return patient
  }

  async findById(id: string, clinicId: string): Promise<PatientWithTutor | null> {
    return this.active.find(p => p.id === id && p.clinicId === clinicId) ?? null
  }

  async update(id: string, data: UpdatePatientDTO): Promise<Patient> {
    const index = this.items.findIndex(p => p.id === id)
    const patch = {
      ...data,
      weightKg: data.weightKg != null ? new Decimal(data.weightKg) : this.items[index].weightKg,
    }
    this.items[index] = { ...this.items[index], ...patch, updatedAt: new Date() }
    return this.items[index]
  }

  async list({ clinicId, search, tutorId, page = 1, perPage = 20 }: ListPatientsDTO): Promise<{ patients: PatientWithTutor[]; total: number }> {
    let patients = this.active.filter(p => p.clinicId === clinicId)
    if (search) patients = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    if (tutorId) patients = patients.filter(p => p.tutorId === tutorId)
    const total = patients.length
    patients = patients.slice((page - 1) * perPage, page * perPage)
    return { patients, total }
  }

  async softDelete(id: string): Promise<void> {
    const index = this.items.findIndex(p => p.id === id)
    if (index === -1) return
    this.items[index] = { ...this.items[index], deletedAt: new Date(), updatedAt: new Date() }
  }
}
