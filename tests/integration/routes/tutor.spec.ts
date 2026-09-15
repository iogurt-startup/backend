import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { FAKE, HTTP, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const VALID_TUTOR_BODY = {
  fullName: 'Tutor Exemplo',
  cpf: FAKE.CPF_VALID,
  phone: FAKE.PHONE,
  email: 'tutor.contato@iougurt.com',
}

describe('Tutor routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('POST /tutors', () => {
    it('cria tutor com 201', async () => {
      prismaMock.tutor.findUnique.mockResolvedValue(null)
      prismaMock.tutor.create.mockResolvedValue(Factory.tutor() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/tutors',
        payload: VALID_TUTOR_BODY,
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().tutor).toMatchObject({ id: SEED.TUTOR_ID })
    })

    it('retorna 401 sem token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tutors',
        payload: VALID_TUTOR_BODY,
      })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })

    it.each([
      { name: 'CPF inválido', body: { ...VALID_TUTOR_BODY, cpf: '00000000000' } },
      { name: 'sem fullName', body: { ...VALID_TUTOR_BODY, fullName: '' } },
      { name: 'phone curto', body: { ...VALID_TUTOR_BODY, phone: '11' } },
      { name: 'email inválido', body: { ...VALID_TUTOR_BODY, email: 'nope' } },
    ])('rejeita payload inválido () com 422', async ({ body }) => {
      const response = await app.injectAuth({ method: 'POST', url: '/tutors', payload: body })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('GET /tutors', () => {
    it('lista tutores com paginação', async () => {
      prismaMock.tutor.findMany.mockResolvedValue([Factory.tutor()] as never)
      prismaMock.tutor.count.mockResolvedValue(1 as never)

      const response = await app.injectAuth({ method: 'GET', url: '/tutors?page=1&perPage=10' })

      expect(response.statusCode).toBe(HTTP.OK)
      const body = response.json()
      expect(body.tutors).toHaveLength(1)
      expect(body.total).toBe(1)
    })

    it('aplica busca pelo nome', async () => {
      prismaMock.tutor.findMany.mockResolvedValue([] as never)
      prismaMock.tutor.count.mockResolvedValue(0 as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: '/tutors?search=fulano',
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().total).toBe(0)
    })
  })

  describe('GET /tutors/:id', () => {
    it('retorna 404 para tutor inexistente', async () => {
      prismaMock.tutor.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'GET',
        url: '/tutors/' + SEED.TUTOR_ID,
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('retorna tutor encontrado', async () => {
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: '/tutors/' + SEED.TUTOR_ID,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().tutor.id).toBe(SEED.TUTOR_ID)
    })

    it('rejeita id não-UUID com 422', async () => {
      const response = await app.injectAuth({ method: 'GET', url: '/tutors/nao-eh-uuid' })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('PUT /tutors/:id', () => {
    it('atualiza tutor com novos dados', async () => {
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
      prismaMock.tutor.update.mockResolvedValue(
        Factory.tutor({ fullName: 'Atualizado' }) as never,
      )

      const response = await app.injectAuth({
        method: 'PUT',
        url: '/tutors/' + SEED.TUTOR_ID,
        payload: { fullName: 'Atualizado' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().tutor.fullName).toBe('Atualizado')
    })
  })

  describe('POST /tutors/:id/account', () => {
    it('cria conta de acesso do tutor e dispara convite sem retornar senha temporária', async () => {
      prismaMock.tutor.findUnique.mockResolvedValue({
        id: SEED.TUTOR_ID,
        fullName: 'Maria Tutor',
        clinicId: SEED.CLINIC_ID,
        userId: null,
        email: null,
        clinic: { id: SEED.CLINIC_ID, name: 'Clínica Iougurt' },
      } as never)

      const createdUser = {
        id: SEED.TUTOR_USER_ID,
        email: 'maria.tutor@iougurt.com',
        name: 'Maria Tutor',
        role: 'TUTOR',
        clinicId: SEED.CLINIC_ID,
      }

      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdUser as never)

      prismaMock.user.create.mockResolvedValue(createdUser as never)

      prismaMock.passwordToken.updateMany.mockResolvedValue({ count: 0 } as never)
      prismaMock.passwordToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'fake-jwt',
        userId: SEED.TUTOR_USER_ID,
      } as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/tutors/' + SEED.TUTOR_ID + '/account',
        payload: { email: 'maria.tutor@iougurt.com' },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      const data = response.json()
      expect(data).toMatchObject({
        userId: SEED.TUTOR_USER_ID,
        email: 'maria.tutor@iougurt.com',
      })
      expect(data).not.toHaveProperty('temporaryPassword')
    })
  })

  describe('POST /tutors/:id/resend-invite', () => {
    it('reenvia o convite de primeiro acesso com 200 OK para tutor pendente', async () => {
      prismaMock.tutor.findUnique.mockResolvedValue({
        id: SEED.TUTOR_ID,
        fullName: 'Maria Tutor',
        clinicId: SEED.CLINIC_ID,
        userId: SEED.TUTOR_USER_ID,
        email: 'maria.tutor@iougurt.com',
        clinic: { id: SEED.CLINIC_ID, name: 'Clínica Iougurt' },
      } as never)

      prismaMock.passwordToken.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({
        id: SEED.TUTOR_USER_ID,
        email: 'maria.tutor@iougurt.com',
        name: 'Maria Tutor',
      } as never)

      prismaMock.passwordToken.updateMany.mockResolvedValue({ count: 0 } as never)
      prismaMock.passwordToken.create.mockResolvedValue({
        id: 'token-2',
        token: 'fake-jwt-2',
        userId: SEED.TUTOR_USER_ID,
      } as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/tutors/' + SEED.TUTOR_ID + '/resend-invite',
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toEqual({ message: 'Convite reenviado com sucesso.' })
    })

    it('rejeita reenvio se o tutor já tiver ativado a conta com 400 BAD_REQUEST', async () => {
      prismaMock.tutor.findUnique.mockResolvedValue({
        id: SEED.TUTOR_ID,
        fullName: 'Maria Tutor',
        clinicId: SEED.CLINIC_ID,
        userId: SEED.TUTOR_USER_ID,
        email: 'maria.tutor@iougurt.com',
      } as never)

      prismaMock.passwordToken.findFirst.mockResolvedValue({
        id: 'token-usado',
        usedAt: new Date(),
      } as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/tutors/' + SEED.TUTOR_ID + '/resend-invite',
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(response.json().error).toBe('O tutor já definiu sua senha e ativou a conta.')
    })
  })
})
