import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { CreateBudgetUseCase, type CreateBudgetInput } from './createBudgetUseCase'
import { GetBudgetDetailsUseCase } from './getBudgetDetailsUseCase'
import { ListClinicBudgetsUseCase } from './listClinicBudgetsUseCase'
import { UpdateBudgetStatusUseCase } from './updateBudgetStatusUseCase'
import { InMemoryBudgetsRepository } from '../repositories/in-memory/InMemoryBudgetsRepository'
import { InMemoryPatientsRepository } from '../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryTutorsRepository } from '../../tutor/repositories/in-memory/InMemoryTutorsRepository'

const CLINIC_ID = 'clinic-1'
const OTHER_CLINIC_ID = 'clinic-2'
const CPF = '52998224725'

function setup() {
  const patients = new InMemoryPatientsRepository()
  const tutors = new InMemoryTutorsRepository()
  const budgets = new InMemoryBudgetsRepository(patients, tutors)
  return {
    patients,
    tutors,
    budgets,
    create: new CreateBudgetUseCase(budgets, patients, tutors),
    details: new GetBudgetDetailsUseCase(budgets),
    list: new ListClinicBudgetsUseCase(budgets),
    updateStatus: new UpdateBudgetStatusUseCase(budgets),
  }
}

async function seed(ctx: ReturnType<typeof setup>, clinicId = CLINIC_ID) {
  const tutor = await ctx.tutors.create({ clinicId, fullName: 'Maria', cpf: CPF, phone: '61999990000' })
  const patient = await ctx.patients.create({
    clinicId,
    name: 'Rex',
    tutorId: tutor.id,
    species: 'CANINE',
    sex: 'MALE',
  })
  return { tutor, patient }
}

function input(
  base: { clinicId: string; patientId: string; tutorId: string },
  overrides: Partial<CreateBudgetInput> = {},
): CreateBudgetInput {
  return {
    ...base,
    items: [{ description: 'Consulta', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

describe('CreateBudgetUseCase', () => {
  let ctx: ReturnType<typeof setup>
  let base: { clinicId: string; patientId: string; tutorId: string }

  beforeEach(async () => {
    ctx = setup()
    const { tutor, patient } = await seed(ctx)
    base = { clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }
  })

  it('calcula subtotais e total a partir de múltiplos itens com decimais', async () => {
    const budget = await ctx.create.execute(input(base, {
      items: [
        { description: 'Vacina', quantity: 3, unitPrice: 19.99 },
        { description: 'Seringa', quantity: 1, unitPrice: 0.1 },
      ],
      discount: 10.5,
    }))

    expect(budget.items.map((i) => i.subtotal)).toEqual([59.97, 0.1])
    expect(budget.discount).toBe(10.5)
    expect(budget.totalAmount).toBe(49.57)
    expect(budget.status).toBe('DRAFT')
  })

  it('evita erro de ponto flutuante na soma (0,1 + 0,2 = 0,3)', async () => {
    const budget = await ctx.create.execute(input(base, {
      items: [
        { description: 'A', quantity: 1, unitPrice: 0.1 },
        { description: 'B', quantity: 1, unitPrice: 0.2 },
      ],
    }))
    expect(budget.totalAmount).toBe(0.3)
  })

  it('aceita PENDING como status inicial', async () => {
    const budget = await ctx.create.execute(input(base, { status: 'PENDING' }))
    expect(budget.status).toBe('PENDING')
  })

  it('rejeita lista vazia de itens', async () => {
    await expect(ctx.create.execute(input(base, { items: [] }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it.each([0, -1])('rejeita quantidade %s', async (quantity) => {
    await expect(
      ctx.create.execute(input(base, { items: [{ description: 'X', quantity, unitPrice: 10 }] })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita preço unitário negativo', async () => {
    await expect(
      ctx.create.execute(input(base, { items: [{ description: 'X', quantity: 1, unitPrice: -1 }] })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita desconto negativo', async () => {
    await expect(ctx.create.execute(input(base, { discount: -1 }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita desconto maior que a soma dos itens', async () => {
    await expect(ctx.create.execute(input(base, { discount: 100.01 }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita status inicial diferente de DRAFT ou PENDING', async () => {
    await expect(
      ctx.create.execute({ ...input(base), status: 'APPROVED' as 'DRAFT' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita paciente inexistente', async () => {
    await expect(ctx.create.execute({ ...input(base), patientId: randomUUID() })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejeita tutor inexistente', async () => {
    await expect(ctx.create.execute({ ...input(base), tutorId: randomUUID() })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejeita paciente soft-deleted', async () => {
    await ctx.patients.softDelete(base.patientId)
    await expect(ctx.create.execute(input(base))).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejeita tutor soft-deleted', async () => {
    await ctx.tutors.softDelete(base.tutorId)
    await expect(ctx.create.execute(input(base))).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejeita paciente e tutor de outra clínica', async () => {
    const other = await seed(ctx, OTHER_CLINIC_ID)
    await expect(
      ctx.create.execute(input({ ...base, patientId: other.patient.id })),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      ctx.create.execute(input({ ...base, tutorId: other.tutor.id })),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejeita paciente que pertence a outro tutor', async () => {
    const otherTutor = await ctx.tutors.create({ clinicId: CLINIC_ID, fullName: 'João', cpf: '39053344705', phone: '61988887777' })
    await expect(
      ctx.create.execute(input({ ...base, tutorId: otherTutor.id })),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('GetBudgetDetailsUseCase', () => {
  it('retorna itens, paciente e tutor', async () => {
    const ctx = setup()
    const { tutor, patient } = await seed(ctx)
    const created = await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }, {
      items: [{ description: 'Vacina', quantity: 2, unitPrice: 30 }],
    }))

    const found = await ctx.details.execute({ id: created.id, clinicId: CLINIC_ID })

    expect(found.items).toHaveLength(1)
    expect(found.items[0]).toMatchObject({ description: 'Vacina', subtotal: 60 })
    expect(found.patient.id).toBe(patient.id)
    expect(found.tutor.id).toBe(tutor.id)
    expect(found.totalAmount).toBe(60)
  })

  it('retorna 404 para clínica diferente', async () => {
    const ctx = setup()
    const { tutor, patient } = await seed(ctx)
    const created = await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }))

    await expect(ctx.details.execute({ id: created.id, clinicId: OTHER_CLINIC_ID })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ListClinicBudgetsUseCase', () => {
  it('pagina, filtra por status e isola por clínica', async () => {
    const ctx = setup()
    const { tutor, patient } = await seed(ctx)
    const other = await seed(ctx, OTHER_CLINIC_ID)
    const base = { clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }

    await ctx.create.execute(input(base))
    await ctx.create.execute(input(base))
    await ctx.create.execute(input(base, { status: 'PENDING' }))
    await ctx.create.execute(input({ clinicId: OTHER_CLINIC_ID, patientId: other.patient.id, tutorId: other.tutor.id }))

    const page1 = await ctx.list.execute({ clinicId: CLINIC_ID, page: 1, limit: 2 })
    expect(page1.total).toBe(3)
    expect(page1.budgets).toHaveLength(2)

    const page2 = await ctx.list.execute({ clinicId: CLINIC_ID, page: 2, limit: 2 })
    expect(page2.budgets).toHaveLength(1)

    const pending = await ctx.list.execute({ clinicId: CLINIC_ID, status: 'PENDING', page: 1, limit: 20 })
    expect(pending.total).toBe(1)
    expect(pending.budgets[0].status).toBe('PENDING')

    const otherClinic = await ctx.list.execute({ clinicId: OTHER_CLINIC_ID, page: 1, limit: 20 })
    expect(otherClinic.total).toBe(1)
  })
})

describe('ListClinicBudgetsUseCase — filtros', () => {
  it('busca por nome do paciente ou do tutor, sem diferenciar maiúsculas', async () => {
    const ctx = setup()
    const maria = await seed(ctx)
    const joao = await ctx.tutors.create({ clinicId: CLINIC_ID, fullName: 'João Souza', cpf: '39053344705', phone: '61988887777' })
    const luna = await ctx.patients.create({ clinicId: CLINIC_ID, name: 'Luna', tutorId: joao.id, species: 'FELINE', sex: 'MALE' })
    await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: maria.patient.id, tutorId: maria.tutor.id }))
    await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: luna.id, tutorId: joao.id }))

    const byPatient = await ctx.list.execute({ clinicId: CLINIC_ID, search: 'LUNA', page: 1, limit: 20 })
    expect(byPatient.total).toBe(1)
    expect(byPatient.budgets[0].patient.name).toBe('Luna')

    const byTutor = await ctx.list.execute({ clinicId: CLINIC_ID, search: 'maria', page: 1, limit: 20 })
    expect(byTutor.total).toBe(1)
    expect(byTutor.budgets[0].tutor.fullName).toBe('Maria')
  })

  it('filtra por paciente e por intervalo de datas (limites inclusivos)', async () => {
    const ctx = setup()
    const { tutor, patient } = await seed(ctx)
    const luna = await ctx.patients.create({ clinicId: CLINIC_ID, name: 'Luna', tutorId: tutor.id, species: 'FELINE', sex: 'MALE' })
    await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }))
    await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: luna.id, tutorId: tutor.id }))
    ctx.budgets.items[0].createdAt = new Date('2026-01-10T12:00:00.000Z')
    ctx.budgets.items[1].createdAt = new Date('2026-02-10T12:00:00.000Z')

    const onlyLuna = await ctx.list.execute({ clinicId: CLINIC_ID, patientId: luna.id, page: 1, limit: 20 })
    expect(onlyLuna.total).toBe(1)

    const exactBound = await ctx.list.execute({
      clinicId: CLINIC_ID,
      from: new Date('2026-01-10T12:00:00.000Z'),
      to: new Date('2026-01-10T12:00:00.000Z'),
      page: 1,
      limit: 20,
    })
    expect(exactBound.total).toBe(1)
    expect(exactBound.budgets[0].patient.id).toBe(patient.id)
  })

  it('combina busca e status, mantendo o isolamento por clínica', async () => {
    const ctx = setup()
    const { tutor, patient } = await seed(ctx)
    await seed(ctx, OTHER_CLINIC_ID)
    const draft = await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }))
    await ctx.create.execute(input({ clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }, { status: 'PENDING' }))
    await ctx.updateStatus.execute({ id: draft.id, clinicId: CLINIC_ID, status: 'PENDING' })

    const result = await ctx.list.execute({ clinicId: CLINIC_ID, search: 'rex', status: 'PENDING', page: 1, limit: 20 })
    expect(result.total).toBe(2)

    const other = await ctx.list.execute({ clinicId: OTHER_CLINIC_ID, search: 'rex', page: 1, limit: 20 })
    expect(other.total).toBe(0)
  })
})

describe('UpdateBudgetStatusUseCase', () => {
  let ctx: ReturnType<typeof setup>
  let base: { clinicId: string; patientId: string; tutorId: string }

  beforeEach(async () => {
    ctx = setup()
    const { tutor, patient } = await seed(ctx)
    base = { clinicId: CLINIC_ID, patientId: patient.id, tutorId: tutor.id }
  })

  it('permite DRAFT -> PENDING -> APPROVED', async () => {
    const draft = await ctx.create.execute(input(base))
    const pending = await ctx.updateStatus.execute({ id: draft.id, clinicId: CLINIC_ID, status: 'PENDING' })
    expect(pending.status).toBe('PENDING')
    const approved = await ctx.updateStatus.execute({ id: draft.id, clinicId: CLINIC_ID, status: 'APPROVED' })
    expect(approved.status).toBe('APPROVED')
  })

  it('permite PENDING -> REJECTED e DRAFT -> EXPIRED', async () => {
    const a = await ctx.create.execute(input(base, { status: 'PENDING' }))
    const rejected = await ctx.updateStatus.execute({ id: a.id, clinicId: CLINIC_ID, status: 'REJECTED' })
    expect(rejected.status).toBe('REJECTED')

    const b = await ctx.create.execute(input(base))
    const expired = await ctx.updateStatus.execute({ id: b.id, clinicId: CLINIC_ID, status: 'EXPIRED' })
    expect(expired.status).toBe('EXPIRED')
  })

  it('bloqueia qualquer alteração após APPROVED (409)', async () => {
    const draft = await ctx.create.execute(input(base))
    await ctx.updateStatus.execute({ id: draft.id, clinicId: CLINIC_ID, status: 'PENDING' })
    await ctx.updateStatus.execute({ id: draft.id, clinicId: CLINIC_ID, status: 'APPROVED' })

    for (const status of ['DRAFT', 'PENDING', 'REJECTED', 'EXPIRED'] as const) {
      await expect(
        ctx.updateStatus.execute({ id: draft.id, clinicId: CLINIC_ID, status }),
      ).rejects.toMatchObject({ statusCode: 409 })
    }
  })

  it('nunca retorna um orçamento ao DRAFT (400)', async () => {
    const pending = await ctx.create.execute(input(base, { status: 'PENDING' }))
    await expect(
      ctx.updateStatus.execute({ id: pending.id, clinicId: CLINIC_ID, status: 'DRAFT' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita transição fora da máquina de estados (400)', async () => {
    const pending = await ctx.create.execute(input(base, { status: 'PENDING' }))
    await ctx.updateStatus.execute({ id: pending.id, clinicId: CLINIC_ID, status: 'REJECTED' })
    await expect(
      ctx.updateStatus.execute({ id: pending.id, clinicId: CLINIC_ID, status: 'PENDING' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('retorna 404 para orçamento de outra clínica e não altera o status', async () => {
    const draft = await ctx.create.execute(input(base))
    await expect(
      ctx.updateStatus.execute({ id: draft.id, clinicId: OTHER_CLINIC_ID, status: 'PENDING' }),
    ).rejects.toMatchObject({ statusCode: 404 })

    const unchanged = await ctx.details.execute({ id: draft.id, clinicId: CLINIC_ID })
    expect(unchanged.status).toBe('DRAFT')
  })
})
