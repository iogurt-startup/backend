import type { Tutor } from '@prisma/client'

export type { Tutor }

export interface CreateTutorDTO {
  clinicId: string
  fullName: string
  cpf: string
  phone: string
  email?: string
  address?: string
  insurance?: string
}

export interface UpdateTutorDTO {
  cpf?: string
  fullName?: string
  phone?: string
  email?: string
  address?: string
  insurance?: string
}

export interface ListTutorsDTO {
  clinicId: string
  search?: string
  page?: number
  perPage?: number
}

// Todos os métodos de busca/listagem consideram apenas tutores ativos (deletedAt = null) — BE-02
export interface ITutorsRepository {
  create(data: CreateTutorDTO): Promise<Tutor>
  findById(id: string, clinicId: string): Promise<Tutor | null>
  findByCpf(cpf: string, clinicId: string): Promise<Tutor | null>
  findByEmail(email: string, clinicId: string): Promise<Tutor | null>
  list(params: ListTutorsDTO): Promise<{ tutors: Tutor[]; total: number }>
  update(id: string, data: UpdateTutorDTO): Promise<Tutor>
  softDelete(id: string): Promise<void>
}
