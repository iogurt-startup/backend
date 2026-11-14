import type { BudgetStatus, Patient, Tutor } from '@prisma/client'

export interface BudgetItemRecord {
  id: string
  budgetId: string
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface BudgetRecord {
  id: string
  clinicId: string
  patientId: string
  tutorId: string
  status: BudgetStatus
  discount: number
  totalAmount: number
  notes: string | null
  validUntil: Date | null
  createdAt: Date
  updatedAt: Date
  items: BudgetItemRecord[]
  patient: Patient
  tutor: Tutor
}

export interface CreateBudgetItemDTO {
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface CreateBudgetDTO {
  clinicId: string
  patientId: string
  tutorId: string
  status: BudgetStatus
  discount: number
  totalAmount: number
  notes?: string
  validUntil?: Date
  items: CreateBudgetItemDTO[]
}

export interface ListBudgetsDTO {
  clinicId: string
  status?: BudgetStatus
  // Nome do paciente OU do tutor (contém, case-insensitive)
  search?: string
  patientId?: string
  // Intervalo inclusivo sobre createdAt
  from?: Date
  to?: Date
  page: number
  limit: number
}

// Todas as leituras são restritas por clinicId (isolamento multi-tenant).
export interface IBudgetsRepository {
  create(data: CreateBudgetDTO): Promise<BudgetRecord>
  findById(id: string, clinicId: string): Promise<BudgetRecord | null>
  findManyByClinic(params: ListBudgetsDTO): Promise<{ budgets: BudgetRecord[]; total: number }>
  // Lock otimista: só grava se o status atual ainda for `expectedStatus`. Retorna null caso contrário.
  updateStatus(
    id: string,
    clinicId: string,
    expectedStatus: BudgetStatus,
    nextStatus: BudgetStatus,
  ): Promise<BudgetRecord | null>
}
