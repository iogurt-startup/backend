import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

type PasswordTokenType = 'FIRST_ACCESS' | 'RECOVERY'

const NEW_PASSWORD = 'NovaSenha@123'
const ONE_HOUR = 60 * 60 * 1000

function issuePasswordToken(type: PasswordTokenType = 'FIRST_ACCESS', overrides: Record<string, unknown> = {}) {
  const purpose = type === 'FIRST_ACCESS' ? 'first-access' : 'password-reset'
  const token = jwt.sign(
    { sub: SEED.TUTOR_USER_ID, purpose, jti: randomUUID() },
    process.env.PASSWORD_RESET_SECRET!,
    { expiresIn: '1h' },
  )
  const record = {
    id: 'password-token-id',
    token,
    userId: SEED.TUTOR_USER_ID,
    type,
    expiresAt: new Date(Date.now() + ONE_HOUR),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
  return { token, record }
}

describe('Password token routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('GET /auth/verify-token', () => {
    it('retorna 200 com e-mail, tipo e perfil para convite válido', async () => {
      const { token, record } = issuePasswordToken()
      prismaMock.passwordToken.findUnique.mockResolvedValue(record as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.tutorUser() as never)

      const response = await app.inject({
        method: 'GET',
        url: `/auth/verify-token?token=${token}`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toEqual({
        email: 'tutor@iougurt.com',
        type: 'FIRST_ACCESS',
        role: ROLE.TUTOR,
      })
      expect(prismaMock.passwordToken.updateMany).not.toHaveBeenCalled()
    })

    it('retorna 404 quando o token não existe', async () => {
      prismaMock.passwordToken.findUnique.mockResolvedValue(null)

      const response = await app.inject({ method: 'GET', url: '/auth/verify-token?token=inexistente' })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('retorna 400 quando o token já foi utilizado', async () => {
      const { token, record } = issuePasswordToken('FIRST_ACCESS', { usedAt: new Date() })
      prismaMock.passwordToken.findUnique.mockResolvedValue(record as never)

      const response = await app.inject({ method: 'GET', url: `/auth/verify-token?token=${token}` })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 400 quando o token está expirado', async () => {
      const { token, record } = issuePasswordToken('FIRST_ACCESS', { expiresAt: new Date(Date.now() - 1000) })
      prismaMock.passwordToken.findUnique.mockResolvedValue(record as never)

      const response = await app.inject({ method: 'GET', url: `/auth/verify-token?token=${token}` })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 422 quando o token não é informado', async () => {
      const response = await app.inject({ method: 'GET', url: '/auth/verify-token' })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('POST /auth/set-password', () => {
    it('retorna 204, grava hash bcrypt da nova senha e consome o token', async () => {
      const { token, record } = issuePasswordToken()
      prismaMock.passwordToken.findUnique.mockResolvedValue(record as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.tutorUser() as never)
      prismaMock.passwordToken.updateMany.mockResolvedValue({ count: 1 } as never)
      prismaMock.user.update.mockResolvedValue(Factory.tutorUser() as never)
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 0 } as never)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/set-password',
        payload: { token, newPassword: NEW_PASSWORD },
      })

      expect(response.statusCode).toBe(HTTP.NO_CONTENT)

      expect(prismaMock.passwordToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token, usedAt: null } }),
      )

      const [[updateArgs]] = prismaMock.user.update.mock.calls as [[{ where: { id: string }, data: { passwordHash: string } }]]
      expect(updateArgs.where.id).toBe(SEED.TUTOR_USER_ID)
      await expect(bcrypt.compare(NEW_PASSWORD, updateArgs.data.passwordHash)).resolves.toBe(true)

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalled()
    })

    it('retorna 422 quando a senha não atende aos requisitos mínimos', async () => {
      const { token } = issuePasswordToken()

      const response = await app.inject({
        method: 'POST',
        url: '/auth/set-password',
        payload: { token, newPassword: 'fraca' },
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
      expect(prismaMock.passwordToken.findUnique).not.toHaveBeenCalled()
    })

    it('retorna 400 e não altera a senha quando o token já foi utilizado', async () => {
      const { token, record } = issuePasswordToken('FIRST_ACCESS', { usedAt: new Date() })
      prismaMock.passwordToken.findUnique.mockResolvedValue(record as never)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/set-password',
        payload: { token, newPassword: NEW_PASSWORD },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('retorna 400 e não altera a senha quando outra requisição consumiu o token antes', async () => {
      const { token, record } = issuePasswordToken()
      prismaMock.passwordToken.findUnique.mockResolvedValue(record as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.tutorUser() as never)
      prismaMock.passwordToken.updateMany.mockResolvedValue({ count: 0 } as never)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/set-password',
        payload: { token, newPassword: NEW_PASSWORD },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('retorna 404 quando o token não existe', async () => {
      prismaMock.passwordToken.findUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/set-password',
        payload: { token: 'inexistente', newPassword: NEW_PASSWORD },
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('POST /auth/password/forgot (tutor)', () => {
    it('gera token de recuperação para tutor e invalida pedidos anteriores', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.tutorUser() as never)
      prismaMock.passwordToken.updateMany.mockResolvedValue({ count: 1 } as never)
      prismaMock.passwordToken.create.mockResolvedValue({} as never)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/password/forgot',
        payload: { email: 'tutor@iougurt.com' },
      })

      expect(response.statusCode).toBe(HTTP.NO_CONTENT)
      expect(prismaMock.passwordToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: SEED.TUTOR_USER_ID, type: 'RECOVERY', usedAt: null },
        }),
      )
      expect(prismaMock.passwordToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: SEED.TUTOR_USER_ID, type: 'RECOVERY' }),
      })
    })
  })
})
