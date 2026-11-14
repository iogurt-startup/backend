import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const BASE = `/clinics/${SEED.CLINIC_ID}/hospitalizations`

describe('Hospitalization routes (EVO-05)', () => {
  let app: TestApp

  beforeAll(async () => {
    app = await TestApp.build()
  })
  afterAll(async () => {
    await app.close()
  })

  describe('GET /clinics/:clinicId/hospitalizations/active', () => {
    it('lista os leitos ocupados', async () => {
      prismaMock.hospitalization.findMany.mockResolvedValue([
        Factory.hospitalization(),
      ] as never)

      const response = await app.injectAuth({ method: 'GET', url: `${BASE}/active` })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toHaveLength(1)
    })

    it('lista vazia também é válida', async () => {
      prismaMock.hospitalization.findMany.mockResolvedValue([] as never)

      const response = await app.injectAuth({ method: 'GET', url: `${BASE}/active` })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toEqual([])
    })

    it('exige autenticação', async () => {
      const response = await app.inject({ method: 'GET', url: `${BASE}/active` })

      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    // Internação é prontuário da clínica: o tutor não pode nem ler. A primeira
    // versão deste módulo aplicava verifyRole só na escrita, e o TUTOR recebia
    // 200 aqui com nome do paciente e evoluções no corpo.
    it('recusa perfil TUTOR na leitura do painel com 403', async () => {
      prismaMock.hospitalization.findMany.mockResolvedValue([
        Factory.hospitalization(),
      ] as never)

      const response = await app.injectAuth(
        { method: 'GET', url: `${BASE}/active` },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    // Esta é a razão de existir o preHandler de escopo: o :clinicId do path é
    // escolhido por quem chama e não autoriza nada por si.
    it('recusa clínica diferente da do token com 403', async () => {
      const response = await app.injectAuth({
        method: 'GET',
        url: `/clinics/${SEED.OTHER_CLINIC_ID}/hospitalizations/active`,
      })

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('POST /clinics/:clinicId/hospitalizations', () => {
    it('admite o paciente', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.hospitalization.findFirst.mockResolvedValue(null)
      prismaMock.hospitalization.create.mockResolvedValue(Factory.hospitalization() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: BASE,
        payload: {
          patientId: SEED.PATIENT_ID,
          bedIdentifier: 'Baia 03',
          reason: 'Pós-operatório de castração',
        },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().status).toBe('ADMITTED')
    })

    it('recusa admissão simultânea com 409', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization() as never,
      )

      const response = await app.injectAuth({
        method: 'POST',
        url: BASE,
        payload: {
          patientId: SEED.PATIENT_ID,
          bedIdentifier: 'Baia 03',
          reason: 'Pós-operatório de castração',
        },
      })

      expect(response.statusCode).toBe(HTTP.CONFLICT)
    })

    it('recusa paciente inexistente com 404', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)

      const response = await app.injectAuth({
        method: 'POST',
        url: BASE,
        payload: {
          patientId: SEED.PATIENT_ID,
          bedIdentifier: 'Baia 03',
          reason: 'Pós-operatório de castração',
        },
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('valida o corpo da requisição', async () => {
      const response = await app.injectAuth({
        method: 'POST',
        url: BASE,
        payload: { patientId: SEED.PATIENT_ID, bedIdentifier: '', reason: 'ok' },
      })

      // Erro de schema no Zod sai como 422 neste projeto, não 400.
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('recusa perfil TUTOR com 403', async () => {
      const response = await app.injectAuth(
        {
          method: 'POST',
          url: BASE,
          payload: {
            patientId: SEED.PATIENT_ID,
            bedIdentifier: 'Baia 03',
            reason: 'Pós-operatório de castração',
          },
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('GET /clinics/:clinicId/hospitalizations/:id', () => {
    it('devolve a internação com a timeline de evoluções', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue({
        ...Factory.hospitalization(),
        patient: {
          id: SEED.PATIENT_ID,
          name: 'Rex',
          species: 'CANINE',
          photoUrl: null,
        },
        admittedByVet: { id: SEED.OWNER_ID, name: 'Dra. Vet' },
        evolutions: [
          {
            ...Factory.hospitalizationEvolution(),
            recordedByVet: { id: SEED.OWNER_ID, name: 'Dra. Vet' },
          },
        ],
      } as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().evolutions).toHaveLength(1)
      expect(response.json().evolutions[0].recordedByVet.name).toBe('Dra. Vet')
    })

    it('recusa internação inexistente com 404', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(null)

      const response = await app.injectAuth({
        method: 'GET',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}`,
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('recusa perfil TUTOR na leitura dos detalhes com 403', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization() as never,
      )

      const response = await app.injectAuth(
        { method: 'GET', url: `${BASE}/${SEED.HOSPITALIZATION_ID}` },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('POST /clinics/:clinicId/hospitalizations/:id/evolutions', () => {
    it('registra a evolução', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization() as never,
      )
      prismaMock.hospitalizationEvolution.create.mockResolvedValue(
        Factory.hospitalizationEvolution() as never,
      )

      const response = await app.injectAuth({
        method: 'POST',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/evolutions`,
        payload: {
          temperature: 38.5,
          heartRate: 90,
          respiratoryRate: 24,
          mucousMembranes: 'Normocoradas',
          notes: 'Aceitou ração, hidratação mantida',
        },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().temperature).toBe(38.5)
    })

    it('recusa evolução em internação com alta com 400', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization({ status: 'DISCHARGED' }) as never,
      )

      const response = await app.injectAuth({
        method: 'POST',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/evolutions`,
        payload: { notes: 'Aferição atrasada' },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('recusa sinal vital fora de faixa plausível', async () => {
      const response = await app.injectAuth({
        method: 'POST',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/evolutions`,
        payload: { heartRate: 2000, notes: 'Erro de digitação' },
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('PATCH /clinics/:clinicId/hospitalizations/:id/status', () => {
    it('marca a internação como CRITICAL', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization() as never,
      )
      prismaMock.hospitalization.updateMany.mockResolvedValue({ count: 1 } as never)
      prismaMock.hospitalization.findUniqueOrThrow.mockResolvedValue(
        Factory.hospitalization({ status: 'CRITICAL' }) as never,
      )

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/status`,
        payload: { status: 'CRITICAL' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().status).toBe('CRITICAL')
    })

    it('recusa DISCHARGED nesta rota', async () => {
      // Alta tem rota própria, porque grava data e orientações.
      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/status`,
        payload: { status: 'DISCHARGED' },
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('recusa troca de status em internação com alta concedida', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization({ status: 'DISCHARGED' }) as never,
      )
      prismaMock.hospitalization.updateMany.mockResolvedValue({ count: 0 } as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/status`,
        payload: { status: 'CRITICAL' },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('recusa perfil TUTOR com 403', async () => {
      const response = await app.injectAuth(
        {
          method: 'PATCH',
          url: `${BASE}/${SEED.HOSPITALIZATION_ID}/status`,
          payload: { status: 'CRITICAL' },
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('PATCH /clinics/:clinicId/hospitalizations/:id/discharge', () => {
    it('concede a alta', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization() as never,
      )
      // A alta agora é `updateMany` com o status no where (a condição é
      // avaliada pelo banco), seguido da releitura do registro.
      prismaMock.hospitalization.updateMany.mockResolvedValue({ count: 1 } as never)
      prismaMock.hospitalization.findUniqueOrThrow.mockResolvedValue(
        Factory.hospitalization({
          status: 'DISCHARGED',
          dischargedAt: new Date('2026-11-13T18:00:00.000Z'),
          dischargeNotes: 'Repouso por 7 dias',
        }) as never,
      )

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/discharge`,
        payload: { dischargeNotes: 'Repouso por 7 dias' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().status).toBe('DISCHARGED')
      expect(response.json().dischargedAt).not.toBeNull()
    })

    it('recusa alta repetida com 400', async () => {
      prismaMock.hospitalization.findFirst.mockResolvedValue(
        Factory.hospitalization({ status: 'DISCHARGED' }) as never,
      )
      prismaMock.hospitalization.updateMany.mockResolvedValue({ count: 0 } as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `${BASE}/${SEED.HOSPITALIZATION_ID}/discharge`,
        payload: {},
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('recusa perfil TUTOR com 403', async () => {
      const response = await app.injectAuth(
        {
          method: 'PATCH',
          url: `${BASE}/${SEED.HOSPITALIZATION_ID}/discharge`,
          payload: {},
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })
})
