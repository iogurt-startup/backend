import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const BUDGET_ID = '77777777-7777-4777-8777-777777777777'
const ITEM_ID = '88888888-8888-4888-8888-888888888888'
const OTHER_CLINIC_ID = '99999999-9999-4999-8999-999999999999'
const NOW = new Date('2026-01-15T10:00:00.000Z')

const budgetsUrl = `/clinics/${SEED.CLINIC_ID}/budgets`

const VALID_BODY = {
  patientId: SEED.PATIENT_ID,
  tutorId: SEED.TUTOR_ID,
  items: [{ description: 'Vacina V10', quantity: 1, unitPrice: 59.97 }],
}

function budgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BUDGET_ID,
    clinicId: SEED.CLINIC_ID,
    patientId: SEED.PATIENT_ID,
    tutorId: SEED.TUTOR_ID,
    status: 'DRAFT',
    discount: new Decimal('0'),
    totalAmount: new Decimal('59.97'),
    notes: null,
    validUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [{
      id: ITEM_ID,
      budgetId: BUDGET_ID,
      description: 'Vacina V10',
      quantity: 1,
      unitPrice: new Decimal('59.97'),
      subtotal: new Decimal('59.97'),
    }],
    patient: Factory.patient(),
    tutor: Factory.tutor(),
    ...overrides,
  }
}

// Repositórios de paciente e tutor consultados pelo CreateBudgetUseCase
function mockActiveRelations() {
  prismaMock.patient.findFirst.mockResolvedValue({ ...Factory.patient(), tutor: Factory.tutor() } as never)
  prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
}

describe('Budget routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('POST /clinics/:clinicId/budgets', () => {
    it('cria orçamento com total calculado no backend', async () => {
      mockActiveRelations()
      prismaMock.budget.create.mockResolvedValue(budgetRow() as never)

      const response = await app.injectAuth({ method: 'POST', url: budgetsUrl, payload: VALID_BODY })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().budget).toMatchObject({ id: BUDGET_ID, status: 'DRAFT', totalAmount: 59.97 })
      expect(prismaMock.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: SEED.CLINIC_ID,
          totalAmount: 59.97,
          discount: 0,
          items: { create: [expect.objectContaining({ subtotal: 59.97 })] },
        }),
        include: expect.any(Object),
      })
    })

    it('retorna 401 sem token', async () => {
      const response = await app.inject({ method: 'POST', url: budgetsUrl, payload: VALID_BODY })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    it('retorna 403 para perfil TUTOR', async () => {
      const response = await app.injectAuth({ method: 'POST', url: budgetsUrl, payload: VALID_BODY }, { role: ROLE.TUTOR })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 403 ao tentar acessar outra clínica pela URL', async () => {
      const response = await app.injectAuth({
        method: 'POST',
        url: `/clinics/${OTHER_CLINIC_ID}/budgets`,
        payload: VALID_BODY,
      })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
      expect(prismaMock.budget.create).not.toHaveBeenCalled()
    })

    it('retorna 422 para payload inválido (itens vazios)', async () => {
      const response = await app.injectAuth({ method: 'POST', url: budgetsUrl, payload: { ...VALID_BODY, items: [] } })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 422 para status inicial fora de DRAFT/PENDING', async () => {
      const response = await app.injectAuth({
        method: 'POST',
        url: budgetsUrl,
        payload: { ...VALID_BODY, status: 'APPROVED' },
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 400 quando o desconto excede o total dos itens', async () => {
      mockActiveRelations()
      const response = await app.injectAuth({
        method: 'POST',
        url: budgetsUrl,
        payload: { ...VALID_BODY, discount: 100 },
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(prismaMock.budget.create).not.toHaveBeenCalled()
    })

    it('retorna 404 quando o paciente não existe nesta clínica', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({ method: 'POST', url: budgetsUrl, payload: VALID_BODY })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('GET /clinics/:clinicId/budgets', () => {
    it('lista paginada filtrada por status e pela clínica do token', async () => {
      prismaMock.budget.findMany.mockResolvedValue([budgetRow({ status: 'PENDING' })] as never)
      prismaMock.budget.count.mockResolvedValue(1)

      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}?status=PENDING&page=1&limit=10` })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toMatchObject({ total: 1, budgets: [{ id: BUDGET_ID, status: 'PENDING' }] })
      expect(prismaMock.budget.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { clinicId: SEED.CLINIC_ID, status: 'PENDING' },
        skip: 0,
        take: 10,
      }))
    })

    it('repassa busca, paciente e intervalo de datas ao repositório', async () => {
      prismaMock.budget.findMany.mockResolvedValue([] as never)
      prismaMock.budget.count.mockResolvedValue(0)

      const response = await app.injectAuth({
        method: 'GET',
        url: `${budgetsUrl}?search=rex&patientId=${SEED.PATIENT_ID}&from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.999Z`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.budget.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          clinicId: SEED.CLINIC_ID,
          patientId: SEED.PATIENT_ID,
          createdAt: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-31T23:59:59.999Z') },
          OR: [
            { patient: { name: { contains: 'rex', mode: 'insensitive' } } },
            { tutor: { fullName: { contains: 'rex', mode: 'insensitive' } } },
          ],
        }),
      }))
    })

    it('retorna 422 quando a data inicial é posterior à final', async () => {
      const response = await app.injectAuth({
        method: 'GET',
        url: `${budgetsUrl}?from=2026-02-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z`,
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 422 para busca com um único caractere', async () => {
      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}?search=a` })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 422 para patientId que não é UUID', async () => {
      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}?patientId=abc` })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 422 para status de filtro inválido', async () => {
      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}?status=NOPE` })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('GET /clinics/:clinicId/budgets/:id', () => {
    it('retorna itens, paciente e tutor', async () => {
      prismaMock.budget.findFirst.mockResolvedValue(budgetRow() as never)

      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}/${BUDGET_ID}` })

      expect(response.statusCode).toBe(HTTP.OK)
      const { budget } = response.json()
      expect(budget.items).toHaveLength(1)
      expect(budget.patient).toBeDefined()
      expect(budget.tutor).toBeDefined()
    })

    it('retorna 404 para orçamento de outra clínica', async () => {
      prismaMock.budget.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}/${BUDGET_ID}` })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('retorna 422 para id que não é UUID', async () => {
      const response = await app.injectAuth({ method: 'GET', url: `${budgetsUrl}/abc` })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('PATCH /clinics/:clinicId/budgets/:id/status', () => {
    it('avança DRAFT -> PENDING', async () => {
      prismaMock.budget.findFirst
        .mockResolvedValueOnce(budgetRow() as never)
        .mockResolvedValueOnce(budgetRow({ status: 'PENDING' }) as never)
      prismaMock.budget.updateMany.mockResolvedValue({ count: 1 })

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${budgetsUrl}/${BUDGET_ID}/status`,
        payload: { status: 'PENDING' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().budget.status).toBe('PENDING')
      expect(prismaMock.budget.updateMany).toHaveBeenCalledWith({
        where: { id: BUDGET_ID, clinicId: SEED.CLINIC_ID, status: 'DRAFT' },
        data: { status: 'PENDING' },
      })
    })

    it('bloqueia alteração após APPROVED (409)', async () => {
      prismaMock.budget.findFirst.mockResolvedValue(budgetRow({ status: 'APPROVED' }) as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${budgetsUrl}/${BUDGET_ID}/status`,
        payload: { status: 'REJECTED' },
      })

      expect(response.statusCode).toBe(HTTP.CONFLICT)
      expect(prismaMock.budget.updateMany).not.toHaveBeenCalled()
    })

    it('impede retorno ao DRAFT (400)', async () => {
      prismaMock.budget.findFirst.mockResolvedValue(budgetRow({ status: 'PENDING' }) as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${budgetsUrl}/${BUDGET_ID}/status`,
        payload: { status: 'DRAFT' },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 422 para status desconhecido', async () => {
      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${budgetsUrl}/${BUDGET_ID}/status`,
        payload: { status: 'PAID' },
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 401 sem token', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${budgetsUrl}/${BUDGET_ID}/status`,
        payload: { status: 'PENDING' },
      })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })
  })
})
