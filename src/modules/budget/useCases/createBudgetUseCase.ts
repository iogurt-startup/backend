import { Errors } from '../../../core/errors'
import type { IPatientsRepository } from '../../patient/repositories/IPatientsRepository'
import type { ITutorsRepository } from '../../tutor/repositories/ITutorsRepository'
import type {
  BudgetRecord,
  CreateBudgetItemDTO,
  IBudgetsRepository,
} from '../repositories/IBudgetsRepository'
import { BUDGET_INITIAL_STATUSES, type InitialBudgetStatus } from '../budgetStatus'

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export interface CreateBudgetItemInput {
  description: string
  quantity: number
  unitPrice: number
}

export interface CreateBudgetInput {
  clinicId: string
  patientId: string
  tutorId: string
  items: CreateBudgetItemInput[]
  discount?: number
  notes?: string
  validUntil?: Date
  status?: InitialBudgetStatus
}

function toItem(item: CreateBudgetItemInput): CreateBudgetItemDTO {
  if (!(item.quantity > 0) || !Number.isFinite(item.quantity)) {
    throw Errors.badRequest('A quantidade de cada item deve ser maior que zero.')
  }
  if (!(item.unitPrice >= 0) || !Number.isFinite(item.unitPrice)) {
    throw Errors.badRequest('O valor unitário de cada item não pode ser negativo.')
  }
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: roundMoney(item.quantity * item.unitPrice),
  }
}

// Todos os valores monetários são calculados aqui, nunca confiados ao cliente.
export class CreateBudgetUseCase {
  constructor(
    private budgetsRepository: IBudgetsRepository,
    private patientsRepository: IPatientsRepository,
    private tutorsRepository: ITutorsRepository,
  ) {}

  async execute(input: CreateBudgetInput): Promise<BudgetRecord> {
    if (input.items.length === 0) {
      throw Errors.badRequest('O orçamento deve ter ao menos 1 item.')
    }
    const items = input.items.map(toItem)

    const patient = await this.patientsRepository.findById(input.patientId, input.clinicId)
    if (!patient) throw Errors.notFound('Paciente não encontrado')

    const tutor = await this.tutorsRepository.findById(input.tutorId, input.clinicId)
    if (!tutor) throw Errors.notFound('Tutor não encontrado')

    if (patient.tutorId !== tutor.id) {
      throw Errors.badRequest('O paciente não pertence ao tutor informado.')
    }

    const status = input.status ?? 'DRAFT'
    if (!BUDGET_INITIAL_STATUSES.includes(status)) {
      throw Errors.badRequest('Orçamento só pode ser criado como DRAFT ou PENDING.')
    }

    const itemsTotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0))
    const discount = roundMoney(input.discount ?? 0)
    if (!Number.isFinite(discount) || discount < 0 || discount > itemsTotal) {
      throw Errors.badRequest('O desconto deve estar entre zero e o total dos itens.')
    }

    return this.budgetsRepository.create({
      clinicId: input.clinicId,
      patientId: input.patientId,
      tutorId: input.tutorId,
      status,
      discount,
      totalAmount: roundMoney(itemsTotal - discount),
      notes: input.notes,
      validUntil: input.validUntil,
      items,
    })
  }
}
