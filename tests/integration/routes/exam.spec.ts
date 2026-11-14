import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

describe('Exam routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('GET /exams/patient/:patientId', () => {
    it('lista exames do paciente', async () => {
      prismaMock.examFile.findMany.mockResolvedValue([Factory.examFile()] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/exams/patient/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toHaveLength(1)
    })

    it('lista exames do paciente filtrando por clinicalType', async () => {
      prismaMock.examFile.findMany.mockResolvedValue([Factory.examFile({ clinicalType: 'HEMOGRAMA' })] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/exams/patient/${SEED.PATIENT_ID}?clinicalType=HEMOGRAMA`,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toHaveLength(1)
      expect(prismaMock.examFile.findMany).toHaveBeenCalledWith({
        where: {
          patientId: SEED.PATIENT_ID,
          clinicalType: 'HEMOGRAMA',
        },
        orderBy: { uploadedAt: 'desc' },
      })
    })

    it('rejeita clinicalType inválido com 422', async () => {
      const response = await app.injectAuth({
        method: 'GET',
        url: `/exams/patient/${SEED.PATIENT_ID}?clinicalType=INVALIDO`,
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('lista vazia também é válida', async () => {
      prismaMock.examFile.findMany.mockResolvedValue([] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/exams/patient/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toEqual([])
    })

    it('rejeita patientId não-UUID com 422', async () => {
      const response = await app.injectAuth({
        method: 'GET',
        url: '/exams/patient/nao-uuid',
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('rejeita sem token com 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/exams/patient/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })
  })

  describe('POST /exams/upload', () => {
    it('exige token de autenticação', async () => {
      const response = await app.inject({ method: 'POST', url: '/exams/upload' })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })
  })
})
