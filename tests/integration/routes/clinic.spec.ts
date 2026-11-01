import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED, FAKE } from '../../utils/constants'
import { prismaMock } from '../../setup'
import { clinicCodeRateLimit } from '../../../src/modules/clinic/infra/http/clinicRoutes'

describe('Clinic routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('GET /clinics/me', () => {
    it('retorna 401 sem token', async () => {
      const response = await app.inject({ method: 'GET', url: '/clinics/me' })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    it('retorna clínica do usuário autenticado', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue(Factory.clinic() as never)
      const response = await app.injectAuth({ method: 'GET', url: '/clinics/me' })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().clinic).toMatchObject({ id: SEED.CLINIC_ID })
    })

    it('retorna 404 quando clínica não encontrada', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue(null)
      const response = await app.injectAuth({ method: 'GET', url: '/clinics/me' })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('PATCH /clinics/me', () => {
    it('atualiza clínica quando role é OWNER', async () => {
      const updated = Factory.clinic({ name: 'Nova Clínica' })
      prismaMock.clinic.update.mockResolvedValue(updated as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: '/clinics/me',
        payload: { name: 'Nova Clínica' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().clinic.name).toBe('Nova Clínica')
    })

    it.each([ROLE.VET, ROLE.TUTOR])('rejeita role %s com 403', async (role) => {
      const response = await app.injectAuth(
        { method: 'PATCH', url: '/clinics/me', payload: { name: 'Nome OK' } },
        { role },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it.each([
      { name: 'CNPJ inválido', body: { cnpj: '00000000000000' } },
      { name: 'nome curto', body: { name: 'a' } },
      { name: 'phone curto', body: { phone: '11' } },
    ])('rejeita payload inválido ($name) com 422', async ({ body }) => {
      const response = await app.injectAuth({ method: 'PATCH', url: '/clinics/me', payload: body })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('aceita CNPJ válido normalizado', async () => {
      prismaMock.clinic.update.mockResolvedValue(Factory.clinic() as never)
      const response = await app.injectAuth({
        method: 'PATCH',
        url: '/clinics/me',
        payload: { cnpj: FAKE.CNPJ_VALID },
      })
      expect(response.statusCode).toBe(HTTP.OK)
    })
  })

  describe('GET /clinics/code/:code', () => {
    it('retorna 200 com os dados da clínica quando o código existe e possui OWNER ativo', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue({
        id: SEED.CLINIC_ID,
        name: 'Clínica IOUGURT',
        code: 'IOUGURT-7A2',
        users: [{ id: SEED.OWNER_ID }],
      } as never)

      const response = await app.inject({
        method: 'GET',
        url: '/clinics/code/IOUGURT-7A2',
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().clinic).toEqual({
        id: SEED.CLINIC_ID,
        name: 'Clínica IOUGURT',
        code: 'IOUGURT-7A2',
      })
    })

    it('aceita código em minúsculo e realiza a busca de forma case-insensitive', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue({
        id: SEED.CLINIC_ID,
        name: 'Clínica IOUGURT',
        code: 'IOUGURT-7A2',
        users: [{ id: SEED.OWNER_ID }],
      } as never)

      const response = await app.inject({
        method: 'GET',
        url: '/clinics/code/iougurt-7a2',
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.clinic.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'IOUGURT-7A2' },
        }),
      )
    })

    it('retorna 404 quando a clínica não é encontrada', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/clinics/code/INEXISTENTE-999',
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
      expect(response.json()).toMatchObject({
        error: expect.stringContaining('não encontrada'),
      })
    })

    it('retorna 400 quando a clínica existe mas não possui nenhum usuário OWNER ativo', async () => {
      prismaMock.clinic.findUnique.mockResolvedValue({
        id: SEED.CLINIC_ID,
        name: 'Clínica Sem Dono',
        code: 'SEMDONO-111',
        users: [],
      } as never)

      const response = await app.inject({
        method: 'GET',
        url: '/clinics/code/SEMDONO-111',
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(response.json()).toMatchObject({
        error: expect.stringContaining('responsável (Owner) ativo'),
      })
    })

    it('rejeita código com menos de 3 caracteres com erro 422 de validação', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/clinics/code/ab',
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 429 quando o limite de consultas por IP é excedido', async () => {
      // App isolado para não consumir o limite compartilhado pelos demais testes
      const isolated = await TestApp.build()
      prismaMock.clinic.findUnique.mockResolvedValue(null)

      try {
        for (let i = 0; i < clinicCodeRateLimit.max; i++) {
          const response = await isolated.inject({ method: 'GET', url: `/clinics/code/TENTATIVA-${i}` })
          expect(response.statusCode).toBe(HTTP.NOT_FOUND)
        }

        const blocked = await isolated.inject({ method: 'GET', url: '/clinics/code/TENTATIVA-X' })
        expect(blocked.statusCode).toBe(HTTP.TOO_MANY_REQUESTS)
      } finally {
        await isolated.close()
      }
    })
  })
})
