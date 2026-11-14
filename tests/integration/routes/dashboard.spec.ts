import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const TREND_DAYS_DEFAULT = 30

describe('Dashboard routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('GET /dashboard/daily', () => {
    it('retorna overview do dia (próprio vet)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.appointment.findMany.mockResolvedValue([
        { status: 'SCHEDULED' }, { status: 'COMPLETED' },
      ] as never)

      const response = await app.injectAuth({ method: 'GET', url: '/dashboard/daily' })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toMatchObject({
        totalAppointments: 2,
        scheduled: 1,
        completed: 1,
      })
    })

    it('VET tentando ver outro vet recebe 403', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.vet() as never)
      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/dashboard/daily?vetId=${SEED.OWNER_ID}`,
        },
        { role: ROLE.VET, userId: SEED.VET_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('GET /dashboard/admin', () => {
    it('OWNER recebe métricas administrativas', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.patient.count.mockResolvedValue(10 as never)
      prismaMock.appointment.count.mockResolvedValue(5 as never)
      prismaMock.appointment.groupBy.mockResolvedValue([] as never)

      const response = await app.injectAuth({ method: 'GET', url: '/dashboard/admin' })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toMatchObject({ totalPatients: 10 })
    })

    it.each([ROLE.VET, ROLE.TUTOR])('rejeita role %s com 403', async (role) => {
      const response = await app.injectAuth(
        { method: 'GET', url: '/dashboard/admin' },
        { role },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('GET /dashboard/admin/appointments-trend', () => {
    it('OWNER recebe tendência com days default', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.appointment.findMany.mockResolvedValue([] as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: '/dashboard/admin/appointments-trend',
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().days).toBe(TREND_DAYS_DEFAULT)
    })

    it.each([6, 91, -1])('rejeita days fora do intervalo [7,90] (%s)', async (days) => {
      const response = await app.injectAuth({
        method: 'GET',
        url: `/dashboard/admin/appointments-trend?days=${days}`,
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('GET /dashboard/recent-activities', () => {
    it.each([ROLE.OWNER, ROLE.VET])('permite acesso para %s', async (role) => {
      prismaMock.appointment.findMany.mockResolvedValue([{
        id: SEED.APPOINTMENT_ID,
        patientId: SEED.PATIENT_ID,
        updatedAt: new Date('2026-11-11T15:00:00.000Z'),
        patient: { name: 'Rex' },
      }] as never)
      prismaMock.patient.findMany.mockResolvedValue([{
        id: SEED.PATIENT_ID,
        name: 'Rex',
        createdAt: new Date('2026-11-11T14:00:00.000Z'),
        tutor: { fullName: 'Maria Silva' },
      }] as never)

      const response = await app.injectAuth(
        { method: 'GET', url: '/dashboard/recent-activities?limit=5' },
        { role },
      )

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toMatchObject({
        recentAppointments: [{
          id: SEED.APPOINTMENT_ID,
          patientId: SEED.PATIENT_ID,
          patientName: 'Rex',
          activityType: 'APPOINTMENT_UPDATED',
        }],
        recentPatients: [{
          id: SEED.PATIENT_ID,
          name: 'Rex',
          tutorName: 'Maria Silva',
          activityType: 'PATIENT_CREATED',
        }],
      })
    })

    it('rejeita acesso de tutor', async () => {
      const response = await app.injectAuth(
        { method: 'GET', url: '/dashboard/recent-activities' },
        { role: ROLE.TUTOR },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it.each([0, 21])('rejeita limit fora do intervalo permitido (%s)', async (limit) => {
      const response = await app.injectAuth({
        method: 'GET',
        url: `/dashboard/recent-activities?limit=${limit}`,
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })
})
