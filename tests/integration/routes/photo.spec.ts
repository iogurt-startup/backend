import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

describe('Patient photo routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('GET /patient-photos/patient/:patientId', () => {
    it('lista as fotos do paciente', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.patientPhoto.findMany.mockResolvedValue([Factory.patientPhoto()] as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: `/patient-photos/patient/${SEED.PATIENT_ID}`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toHaveLength(1)
    })

    it('lista vazia também é válida', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.patientPhoto.findMany.mockResolvedValue([] as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: `/patient-photos/patient/${SEED.PATIENT_ID}`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toEqual([])
    })

    it('responde 404 para paciente de outra clínica', async () => {
      // O repositório filtra por clínica, então um paciente de outra clínica
      // simplesmente não é encontrado.
      prismaMock.patient.findFirst.mockResolvedValue(null as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: `/patient-photos/patient/${SEED.PATIENT_ID}`,
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('rejeita patientId não-UUID com 422', async () => {
      const response = await app.injectAuth({
        method: 'GET',
        url: '/patient-photos/patient/nao-uuid',
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('rejeita sem token com 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/patient-photos/patient/${SEED.PATIENT_ID}`,
      })

      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })
  })

  describe('POST /patient-photos/upload', () => {
    it('exige token de autenticação', async () => {
      const response = await app.inject({ method: 'POST', url: '/patient-photos/upload' })

      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    it('rejeita SVG (image/svg+xml) com 400', async () => {
      const boundary = '----photo-svg-boundary'
      const body =
        `--${boundary}\r\nContent-Disposition: form-data; name="patientId"\r\n\r\n${SEED.PATIENT_ID}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.svg"\r\n` +
        `Content-Type: image/svg+xml\r\n\r\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>\r\n` +
        `--${boundary}--\r\n`

      const response = await app.injectAuth({
        method: 'POST',
        url: '/patient-photos/upload',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('rejeita requisição sem arquivo', async () => {
      const response = await app.injectAuth({
        method: 'POST',
        url: '/patient-photos/upload',
        headers: { 'content-type': 'application/json' },
        payload: {},
      })

      expect(response.statusCode).toBeGreaterThanOrEqual(HTTP.BAD_REQUEST)
    })
  })
})
