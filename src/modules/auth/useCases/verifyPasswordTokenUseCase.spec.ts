import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '../../../config/env'
import { InMemoryUsersRepository } from '../repositories/in-memory/InMemoryUsersRepository'
import { InMemoryPasswordTokensRepository } from '../repositories/in-memory/InMemoryPasswordTokensRepository'
import type { PasswordTokenType } from '../repositories/IPasswordTokensRepository'
import { VerifyPasswordTokenUseCase } from './verifyPasswordTokenUseCase'

const PURPOSE: Record<PasswordTokenType, string> = {
  FIRST_ACCESS: 'first-access',
  RECOVERY: 'password-reset',
}
const ONE_HOUR = 60 * 60 * 1000

describe('VerifyPasswordTokenUseCase', () => {
  let usersRepository: InMemoryUsersRepository
  let passwordTokensRepository: InMemoryPasswordTokensRepository
  let sut: VerifyPasswordTokenUseCase

  beforeEach(() => {
    env.JWT_SECRET = 'test-jwt-secret'
    env.PASSWORD_RESET_SECRET = 'test-reset-secret'

    usersRepository = new InMemoryUsersRepository()
    passwordTokensRepository = new InMemoryPasswordTokensRepository()
    sut = new VerifyPasswordTokenUseCase(usersRepository, passwordTokensRepository)
  })

  function createTutor() {
    return usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })
  }

  async function issueToken(
    userId: string,
    type: PasswordTokenType,
    { purpose = PURPOSE[type], secret = env.PASSWORD_RESET_SECRET, expiresAt = new Date(Date.now() + ONE_HOUR) } = {},
  ) {
    const token = jwt.sign({ sub: userId, purpose, jti: randomUUID() }, secret, { expiresIn: '1h' })
    await passwordTokensRepository.create(userId, token, expiresAt, type)
    return token
  }

  it('deve retornar e-mail, tipo e perfil para um convite de primeiro acesso válido', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS')

    const result = await sut.execute({ token })

    expect(result).toEqual({ email: 'carlos@exemplo.com', type: 'FIRST_ACCESS', role: 'TUTOR' })
  })

  it('deve aceitar token de recuperação de senha', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'RECOVERY')

    await expect(sut.execute({ token })).resolves.toMatchObject({ type: 'RECOVERY' })
  })

  it('não deve consumir o token ao apenas verificá-lo', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS')

    await sut.execute({ token })

    expect(passwordTokensRepository.items[0].usedAt).toBeNull()
  })

  it('deve lançar 404 quando o token não existe', async () => {
    await expect(sut.execute({ token: 'inexistente' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deve lançar 400 quando o token já foi utilizado', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS')
    await passwordTokensRepository.markAsUsed(token)

    await expect(sut.execute({ token })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('deve lançar 400 quando o token está expirado', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS', { expiresAt: new Date(Date.now() - 1000) })

    await expect(sut.execute({ token })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('deve lançar 400 quando a finalidade do JWT não corresponde ao tipo do token', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS', { purpose: 'password-reset' })

    await expect(sut.execute({ token })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('deve lançar 400 quando a assinatura do JWT é inválida', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS', { secret: 'outro-secret' })

    await expect(sut.execute({ token })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('deve lançar 404 quando o usuário do token não existe mais', async () => {
    const token = await issueToken('usuario-removido', 'FIRST_ACCESS')

    await expect(sut.execute({ token })).rejects.toMatchObject({ statusCode: 404 })
  })
})
