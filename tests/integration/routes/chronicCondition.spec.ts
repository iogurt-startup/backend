import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { CHRONIC_CONDITION, HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const OTHER_CLINIC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PAST_ISO = '2026-01-01T12:00:00.000Z'
const FAR_FUTURE_ISO = '2999-01-01T12:00:00.000Z'

describe('Chronic condition routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('autenticação e autorização', () => {
    const routes = [
      { method: 'POST', url: '/chronic-conditions', payload: { patientId: SEED.PATIENT_ID, name: 'Asma' } },
      { method: 'GET', url: `/chronic-conditions/patient/${SEED.PATIENT_ID}` },
      { method: 'PATCH', url: `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, payload: { status: 'RESOLVED' } },
    ] as const

    const writeRoutes = [
      { method: 'POST', url: '/chronic-conditions', payload: { patientId: SEED.PATIENT_ID, name: 'Asma' } },
      { method: 'PATCH', url: `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, payload: { status: 'RESOLVED' } },
    ] as const

    it.each(routes)('retorna 401 sem token em $method $url', async ({ method, url, ...rest }) => {
      const response = await app.inject({ method, url, ...('payload' in rest ? { payload: rest.payload } : {}) })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    it.each(writeRoutes)('retorna 403 para TUTOR em $method $url', async ({ method, url, ...rest }) => {
      const response = await app.injectAuth(
        { method, url, ...('payload' in rest ? { payload: rest.payload } : {}) },
        { role: ROLE.TUTOR },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
      expect(prismaMock.chronicCondition.create).not.toHaveBeenCalled()
      expect(prismaMock.chronicCondition.update).not.toHaveBeenCalled()
    })

    it.each([ROLE.OWNER, ROLE.VET, ROLE.TUTOR])('permite leitura para o perfil %s', async (role) => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.chronicCondition.findMany.mockResolvedValue([] as never)
      const response = await app.injectAuth(
        { method: 'GET', url: `/chronic-conditions/patient/${SEED.PATIENT_ID}` },
        { role },
      )
      expect(response.statusCode).toBe(HTTP.OK)
    })
  })

  describe('fluxo criar → listar → atualizar', () => {
    it('registra, lista e atualiza uma patologia', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)

      prismaMock.chronicCondition.create.mockResolvedValue(
        Factory.chronicCondition({ observations: 'Insulina 2x ao dia' }) as never,
      )
      const created = await app.injectAuth({
        method: 'POST',
        url: '/chronic-conditions',
        payload: {
          patientId: SEED.PATIENT_ID,
          name: 'Diabetes mellitus',
          diagnosedAt: PAST_ISO,
          status: 'ACTIVE',
          observations: 'Insulina 2x ao dia',
        },
      })
      expect(created.statusCode).toBe(HTTP.CREATED)
      expect(created.json()).toMatchObject({
        id: SEED.CHRONIC_CONDITION_ID,
        patientId: SEED.PATIENT_ID,
        name: 'Diabetes mellitus',
        status: 'ACTIVE',
        observations: 'Insulina 2x ao dia',
      })
      expect(typeof created.json().diagnosedAt).toBe('string')

      prismaMock.chronicCondition.findMany.mockResolvedValue([
        Factory.chronicCondition({ observations: 'Insulina 2x ao dia' }),
      ] as never)
      const listed = await app.injectAuth({
        method: 'GET',
        url: `/chronic-conditions/patient/${SEED.PATIENT_ID}`,
      })
      expect(listed.statusCode).toBe(HTTP.OK)
      expect(listed.json().items).toHaveLength(1)
      expect(listed.json().items[0].name).toBe('Diabetes mellitus')

      prismaMock.chronicCondition.findFirst.mockResolvedValue(Factory.chronicCondition() as never)
      prismaMock.chronicCondition.update.mockResolvedValue(
        Factory.chronicCondition({ status: 'RESOLVED', observations: null }) as never,
      )
      const updated = await app.injectAuth({
        method: 'PATCH',
        url: `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`,
        payload: { status: 'RESOLVED', observations: null },
      })
      expect(updated.statusCode).toBe(HTTP.OK)
      expect(updated.json()).toMatchObject({ status: 'RESOLVED', observations: null })
      expect(prismaMock.chronicCondition.update).toHaveBeenCalledWith({
        where: { id: SEED.CHRONIC_CONDITION_ID },
        data: { status: 'RESOLVED', observations: null },
      })
    })

    it('serializa diagnosedAt nulo', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.chronicCondition.findMany.mockResolvedValue([
        Factory.chronicCondition({ diagnosedAt: null }),
      ] as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: `/chronic-conditions/patient/${SEED.PATIENT_ID}`,
      })

      expect(response.json().items[0].diagnosedAt).toBeNull()
    })

    it('usa status ACTIVE por padrão ao criar', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.chronicCondition.create.mockResolvedValue(Factory.chronicCondition() as never)

      await app.injectAuth({
        method: 'POST',
        url: '/chronic-conditions',
        payload: { patientId: SEED.PATIENT_ID, name: 'Asma' },
      })

      expect(prismaMock.chronicCondition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ patientId: SEED.PATIENT_ID, name: 'Asma', status: 'ACTIVE' }),
      })
    })
  })

  describe('isolamento por clínica e paciente', () => {
    it('valida o paciente com a clínica do token e ignora pacientes excluídos', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.chronicCondition.findMany.mockResolvedValue([] as never)

      await app.injectAuth({ method: 'GET', url: `/chronic-conditions/patient/${SEED.PATIENT_ID}` })

      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SEED.PATIENT_ID, clinicId: SEED.CLINIC_ID, deletedAt: null },
        }),
      )
    })

    it('retorna 404 ao criar para paciente de outra clínica ou inexistente', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)

      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/chronic-conditions',
          payload: { patientId: SEED.PATIENT_ID, name: 'Asma' },
        },
        { clinicId: OTHER_CLINIC_ID },
      )

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SEED.PATIENT_ID, clinicId: OTHER_CLINIC_ID, deletedAt: null },
        }),
      )
      expect(prismaMock.chronicCondition.create).not.toHaveBeenCalled()
    })

    it('retorna 404 ao listar paciente de outra clínica sem consultar patologias', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)

      const response = await app.injectAuth(
        { method: 'GET', url: `/chronic-conditions/patient/${SEED.PATIENT_ID}` },
        { clinicId: OTHER_CLINIC_ID },
      )

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
      expect(prismaMock.chronicCondition.findMany).not.toHaveBeenCalled()
    })

    it('retorna 404 ao atualizar patologia de outra clínica e consulta escopada pelo token', async () => {
      prismaMock.chronicCondition.findFirst.mockResolvedValue(null)

      const response = await app.injectAuth(
        {
          method: 'PATCH',
          url: `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`,
          payload: { status: 'INACTIVE' },
        },
        { clinicId: OTHER_CLINIC_ID },
      )

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
      expect(prismaMock.chronicCondition.findFirst).toHaveBeenCalledWith({
        where: {
          id: SEED.CHRONIC_CONDITION_ID,
          patient: { clinicId: OTHER_CLINIC_ID, deletedAt: null },
        },
      })
      expect(prismaMock.chronicCondition.update).not.toHaveBeenCalled()
    })
  })

  describe('regras de negócio', () => {
    it('rejeita data de diagnóstico futura com 400', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/chronic-conditions',
        payload: { patientId: SEED.PATIENT_ID, name: 'Asma', diagnosedAt: FAR_FUTURE_ISO },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(prismaMock.chronicCondition.create).not.toHaveBeenCalled()
    })
  })

  describe('validação de schema (422)', () => {
    const validCreate = { patientId: SEED.PATIENT_ID, name: 'Asma' }

    it.each([
      ['patientId inválido', { ...validCreate, patientId: 'not-uuid' }],
      ['nome ausente', { patientId: SEED.PATIENT_ID }],
      ['nome com 1 caractere', { ...validCreate, name: 'a' }],
      ['nome acima de 120 caracteres', { ...validCreate, name: 'a'.repeat(121) }],
      ['status inválido', { ...validCreate, status: 'DONE' }],
      ['diagnosedAt inválido', { ...validCreate, diagnosedAt: '2026-13-45' }],
      ['observações acima de 2000 caracteres', { ...validCreate, observations: 'a'.repeat(2001) }],
    ])('POST rejeita %s', async (_label, payload) => {
      const response = await app.injectAuth({ method: 'POST', url: '/chronic-conditions', payload })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
      expect(prismaMock.chronicCondition.create).not.toHaveBeenCalled()
    })

    it.each(CHRONIC_CONDITION.STATUSES)('POST aceita o status %s', async (status) => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.chronicCondition.create.mockResolvedValue(Factory.chronicCondition({ status }) as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/chronic-conditions',
        payload: { ...validCreate, status },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
    })

    it('GET rejeita patientId inválido', async () => {
      const response = await app.injectAuth({ method: 'GET', url: '/chronic-conditions/patient/not-uuid' })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it.each([
      ['id inválido na URL', '/chronic-conditions/not-uuid', { status: 'RESOLVED' }],
      ['body vazio', `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, {}],
      ['status inválido', `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, { status: 'DONE' }],
      ['patientId não editável', `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, { patientId: SEED.PATIENT_ID }],
      ['campo desconhecido', `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, { foo: 'bar' }],
      ['nome com 1 caractere', `/chronic-conditions/${SEED.CHRONIC_CONDITION_ID}`, { name: 'a' }],
    ])('PATCH rejeita %s', async (_label, url, payload) => {
      const response = await app.injectAuth({ method: 'PATCH', url, payload })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
      expect(prismaMock.chronicCondition.update).not.toHaveBeenCalled()
    })
  })
})
