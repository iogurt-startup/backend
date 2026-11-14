import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

describe('Vaccination Alerts routes (EVO-06)', () => {
  let app: TestApp

  const CLINIC_ID = SEED.CLINIC_ID
  // Precisa ser um UUID v4 válido: a rota valida o parâmetro com
  // `z.string().uuid()` antes de comparar as clínicas. Com um UUID inválido a
  // requisição morre em 422 e o teste de multitenancy nunca chega na guarda
  // que ele diz exercitar.
  const OTHER_CLINIC_ID = '99999999-9999-4999-8999-999999999999'
  const NOW = new Date('2026-11-12T12:00:00.000Z')

  beforeAll(async () => {
    app = await TestApp.build()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /clinics/:clinicId/vaccinations/alerts', () => {
    it('retorna 401 sem autenticação', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/clinics/${CLINIC_ID}/vaccinations/alerts`,
      })

      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    it('retorna 403 quando papel for TUTOR', async () => {
      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinics/${CLINIC_ID}/vaccinations/alerts`,
        },
        { role: ROLE.TUTOR, clinicId: CLINIC_ID }
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 403 se o usuário tentar acessar alertas de outra clínica (multitenancy)', async () => {
      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinics/${OTHER_CLINIC_ID}/vaccinations/alerts`,
        },
        { role: ROLE.VET, clinicId: CLINIC_ID }
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 400 se o status informado na query for inválido', async () => {
      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinics/${CLINIC_ID}/vaccinations/alerts?status=INVALID_STATUS`,
        },
        { role: ROLE.VET, clinicId: CLINIC_ID }
      )

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 200 com lista de alertas da clínica', async () => {
      const pastDose = dayjs().subtract(10, 'day').toDate()
      const futureDose = dayjs().add(5, 'day').toDate()

      const mockVaccinations = [
        {
          ...Factory.vaccination({
            id: 'vac-1',
            patientId: SEED.PATIENT_ID,
            vaccineName: 'V10',
            doseNumber: 1,
            appliedAt: dayjs().subtract(31, 'day').toDate(),
            nextDoseAt: pastDose,
            status: 'UP_TO_DATE',
          }),
          patient: {
            id: SEED.PATIENT_ID,
            name: 'Rex',
            species: 'CANINE',
            clinicId: CLINIC_ID,
            deletedAt: null,
            tutor: {
              id: SEED.TUTOR_ID,
              fullName: 'Carlos Tutor',
              phone: '61999998888',
            },
          },
        },
        {
          ...Factory.vaccination({
            id: 'vac-2',
            patientId: 'patient-2',
            vaccineName: 'Antirrábica',
            doseNumber: 1,
            appliedAt: null,
            nextDoseAt: futureDose,
            status: 'PENDING',
          }),
          patient: {
            id: 'patient-2',
            name: 'Mimi',
            species: 'FELINE',
            clinicId: CLINIC_ID,
            deletedAt: null,
            tutor: {
              id: 'tutor-2',
              fullName: 'Mariana Lima',
              phone: '61988881111',
            },
          },
        },
      ]

      prismaMock.vaccination.findMany.mockResolvedValue(mockVaccinations as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinics/${CLINIC_ID}/vaccinations/alerts`,
        },
        { role: ROLE.VET, clinicId: CLINIC_ID }
      )

      expect(response.statusCode).toBe(HTTP.OK)
      const data = response.json()
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      expect(data.total).toBe(2)

      const overdue = data.items.find((i: any) => i.status === 'OVERDUE')
      expect(overdue).toBeDefined()
      expect(overdue.vaccineName).toBe('V10')
      expect(overdue.patient.name).toBe('Rex')
      expect(overdue.tutor.fullName).toBe('Carlos Tutor')

      const upcoming = data.items.find((i: any) => i.status === 'UPCOMING')
      expect(upcoming).toBeDefined()
      expect(upcoming.vaccineName).toBe('Antirrábica')
      expect(upcoming.patient.name).toBe('Mimi')
    })

    it('filtra apenas OVERDUE quando query param status=OVERDUE for enviado', async () => {
      const pastDose = dayjs().subtract(4, 'day').toDate()
      const futureDose = dayjs().add(5, 'day').toDate()

      const mockVaccinations = [
        {
          ...Factory.vaccination({
            id: 'vac-1',
            patientId: SEED.PATIENT_ID,
            vaccineName: 'V10',
            doseNumber: 1,
            appliedAt: null,
            nextDoseAt: pastDose,
            status: 'OVERDUE',
          }),
          patient: {
            id: SEED.PATIENT_ID,
            name: 'Rex',
            species: 'CANINE',
            clinicId: CLINIC_ID,
            deletedAt: null,
            tutor: {
              id: SEED.TUTOR_ID,
              fullName: 'Carlos Tutor',
              phone: '61999998888',
            },
          },
        },
        {
          ...Factory.vaccination({
            id: 'vac-2',
            patientId: 'patient-2',
            vaccineName: 'V8',
            doseNumber: 1,
            appliedAt: null,
            nextDoseAt: futureDose,
            status: 'PENDING',
          }),
          patient: {
            id: 'patient-2',
            name: 'Mimi',
            species: 'FELINE',
            clinicId: CLINIC_ID,
            deletedAt: null,
            tutor: {
              id: 'tutor-2',
              fullName: 'Mariana Lima',
              phone: '61988881111',
            },
          },
        },
      ]

      prismaMock.vaccination.findMany.mockResolvedValue(mockVaccinations as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinics/${CLINIC_ID}/vaccinations/alerts?status=OVERDUE`,
        },
        { role: ROLE.OWNER, clinicId: CLINIC_ID }
      )

      expect(response.statusCode).toBe(HTTP.OK)
      const data = response.json()
      expect(data.total).toBe(1)
      expect(data.items[0].status).toBe('OVERDUE')
      expect(data.items[0].vaccineName).toBe('V10')
    })
  })

  describe('GET /portal/alerts (integração tutor EVO-06)', () => {
    it('retorna alertas de vacina com dados completos para agendamento', async () => {
      const pastDose = dayjs().subtract(7, 'day').toDate()

      prismaMock.user.findUnique.mockResolvedValue({
        ...Factory.tutorUser(),
        tutorAccount: {
          ...Factory.tutor({ id: SEED.TUTOR_ID, userId: SEED.TUTOR_USER_ID }),
          patients: [Factory.patient({ id: SEED.PATIENT_ID, tutorId: SEED.TUTOR_ID })],
        },
      } as never)

      prismaMock.vaccination.findMany.mockResolvedValue([
        {
          ...Factory.vaccination({
            id: 'vac-tutor-1',
            patientId: SEED.PATIENT_ID,
            vaccineName: 'Raiva',
            doseNumber: 2,
            appliedAt: null,
            nextDoseAt: pastDose,
            status: 'OVERDUE',
          }),
          patient: {
            id: SEED.PATIENT_ID,
            name: 'Pipoca',
            species: 'CANINE',
            clinicId: CLINIC_ID,
            deletedAt: null,
            tutor: {
              id: SEED.TUTOR_ID,
              fullName: 'Tutor Teste',
              phone: '61988887777',
            },
          },
        },
      ] as never)

      prismaMock.clinicalRecord.findFirst.mockResolvedValue(null)

      const response = await app.injectAuth(
        { method: 'GET', url: '/portal/alerts' },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID }
      )

      expect(response.statusCode).toBe(HTTP.OK)
      const data = response.json()
      expect(data.alerts).toBeInstanceOf(Array)
      expect(data.alerts.length).toBeGreaterThan(0)

      const alert = data.alerts.find((a: any) => a.type === 'overdue_vaccine')
      expect(alert).toBeDefined()
      expect(alert.vaccineName).toBe('Raiva')
      expect(alert.doseNumber).toBe(2)
      expect(alert.patientName).toBe('Pipoca')
      expect(alert.patientId).toBe(SEED.PATIENT_ID)
    })
  })
})
