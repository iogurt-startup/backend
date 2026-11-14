import type { BudgetStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/prisma'
import type {
  BudgetRecord,
  CreateBudgetDTO,
  IBudgetsRepository,
  ListBudgetsDTO,
} from '../../repositories/IBudgetsRepository'

const relations = { items: true, patient: true, tutor: true } as const

type BudgetRow = Prisma.BudgetGetPayload<{ include: typeof relations }>

// Decimal -> number apenas na borda do repositório; o domínio trabalha com number arredondado a 2 casas.
function toRecord(row: BudgetRow): BudgetRecord {
  return {
    ...row,
    discount: row.discount.toNumber(),
    totalAmount: row.totalAmount.toNumber(),
    items: row.items.map((item) => ({
      id: item.id,
      budgetId: item.budgetId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      subtotal: item.subtotal.toNumber(),
    })),
  }
}

export class PrismaBudgetsRepository implements IBudgetsRepository {
  async create(data: CreateBudgetDTO): Promise<BudgetRecord> {
    // Nested create: Budget + items numa única operação (transação implícita do Prisma).
    const row = await prisma.budget.create({
      data: {
        clinicId: data.clinicId,
        patientId: data.patientId,
        tutorId: data.tutorId,
        status: data.status,
        discount: data.discount,
        totalAmount: data.totalAmount,
        notes: data.notes,
        validUntil: data.validUntil,
        items: { create: data.items },
      },
      include: relations,
    })
    return toRecord(row)
  }

  async findById(id: string, clinicId: string): Promise<BudgetRecord | null> {
    const row = await prisma.budget.findFirst({ where: { id, clinicId }, include: relations })
    return row ? toRecord(row) : null
  }

  async findManyByClinic({ clinicId, status, search, patientId, from, to, page, limit }: ListBudgetsDTO): Promise<{ budgets: BudgetRecord[]; total: number }> {
    const where: Prisma.BudgetWhereInput = {
      clinicId,
      ...(status ? { status } : {}),
      ...(patientId ? { patientId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(search
        ? {
            OR: [
              { patient: { name: { contains: search, mode: 'insensitive' as const } } },
              { tutor: { fullName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        include: relations,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.budget.count({ where }),
    ])
    return { budgets: rows.map(toRecord), total }
  }

  async updateStatus(
    id: string,
    clinicId: string,
    expectedStatus: BudgetStatus,
    nextStatus: BudgetStatus,
  ): Promise<BudgetRecord | null> {
    const result = await prisma.budget.updateMany({
      where: { id, clinicId, status: expectedStatus },
      data: { status: nextStatus },
    })
    if (result.count === 0) return null
    const row = await prisma.budget.findFirst({ where: { id, clinicId }, include: relations })
    return row ? toRecord(row) : null
  }
}
