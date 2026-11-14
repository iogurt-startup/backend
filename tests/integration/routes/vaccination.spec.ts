import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, SEED, VACCINATION } from '../../utils/constants'
import { prismaMock } from '../../setup'

const PAST_ISO = '2026-01-01T10:00:00.000Z'
const FUTURE_ISO = '2026-12-31T10:00:00.000Z'

describe('Vaccination routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('POST /vaccinations', () => {
    it('adiciona vacina UP_TO_DATE com appliedAt', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.vaccination.create.mockResolvedValue(Factory.vaccination() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/vaccinations',
        payload: {
          patientId: SEED.PATIENT_ID,
          vaccineName: 'V8',
          status: 'UP_TO_DATE',
          appliedAt: PAST_ISO,
        },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
    })

    it('adiciona vacina UP_TO_DATE calculando nextDoseAt a partir do intervalo e persistindo doseNumber e intervalDays', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.vaccination.create.mockImplementation(async ({ data }: any) => {
        return Factory.vaccination({
          ...data,
          id: SEED.VACCINATION_ID,
          createdAt: new Date(),
        }) as never
      })

      const response = await app.injectAuth({
        method: 'POST',
        url: '/vaccinations',
        payload: {
          patientId: SEED.PATIENT_ID,
          vaccineName: 'V10',
          status: 'UP_TO_DATE',
          appliedAt: '2026-05-10T10:00:00.000Z',
          doseNumber: 1,
          intervalDays: 21,
        },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      const body = response.json()
      expect(body.doseNumber).toBe(1)
      expect(body.intervalDays).toBe(21)
      expect(new Date(body.nextDoseAt).toISOString()).toBe(new Date('2026-05-31T10:00:00.000Z').toISOString())
      expect(prismaMock.vaccination.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doseNumber: 1,
            intervalDays: 21,
            nextDoseAt: new Date('2026-05-31T10:00:00.000Z'),
          }),
        })
      )
    })

    it('rejeita UP_TO_DATE sem appliedAt', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      const response = await app.injectAuth({
        method: 'POST',
        url: '/vaccinations',
        payload: {
          patientId: SEED.PATIENT_ID,
          vaccineName: 'V8',
          status: 'UP_TO_DATE',
        },
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('rejeita PENDING sem nextDoseAt', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      const response = await app.injectAuth({
        method: 'POST',
        url: '/vaccinations',
        payload: {
          patientId: SEED.PATIENT_ID,
          vaccineName: 'V8',
          status: 'PENDING',
        },
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 404 quando paciente não existe', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'POST',
        url: '/vaccinations',
        payload: {
          patientId: SEED.PATIENT_ID,
          vaccineName: 'V8',
          status: 'PENDING',
          nextDoseAt: FUTURE_ISO,
        },
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('GET /vaccinations/patient/:patientId', () => {
    it('lista vacinas do paciente', async () => {
      prismaMock.vaccination.findMany.mockResolvedValue([Factory.vaccination()] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/vaccinations/patient/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toHaveLength(1)
    })
  })

  describe('PATCH /vaccinations/:id/status', () => {
    it.each(VACCINATION.STATUSES.filter((s) => s !== 'UP_TO_DATE'))(
      'altera status PENDING para %s',
      async (newStatus) => {
        prismaMock.vaccination.findFirst.mockResolvedValue(
          Factory.vaccination({ status: 'PENDING' }) as never,
        )
        prismaMock.vaccination.update.mockResolvedValue(
          Factory.vaccination({ status: newStatus }) as never,
        )

        const response = await app.injectAuth({
          method: 'PATCH',
          url: `/vaccinations/${SEED.VACCINATION_ID}/status`,
          payload: { status: newStatus },
        })

        expect(response.statusCode).toBe(HTTP.OK)
      },
    )

    it('rejeita alteração de vacina UP_TO_DATE', async () => {
      prismaMock.vaccination.findFirst.mockResolvedValue(
        Factory.vaccination({ status: 'UP_TO_DATE' }) as never,
      )
      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/vaccinations/${SEED.VACCINATION_ID}/status`,
        payload: { status: 'PENDING' },
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 404 quando vacina não existe', async () => {
      prismaMock.vaccination.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/vaccinations/${SEED.VACCINATION_ID}/status`,
        payload: { status: 'PENDING' },
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })
})
