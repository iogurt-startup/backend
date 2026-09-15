import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '../../../config/env'
import { InMemoryUsersRepository } from '../repositories/in-memory/InMemoryUsersRepository'
import { InMemoryPasswordTokensRepository } from '../repositories/in-memory/InMemoryPasswordTokensRepository'
import { InMemoryRefreshTokensRepository } from '../repositories/in-memory/InMemoryRefreshTokensRepository'
import type { PasswordTokenType } from '../repositories/IPasswordTokensRepository'
import type { IHashProvider } from '../providers/IHashProvider'
import { SetPasswordUseCase } from './setPasswordUseCase'

class FakeHashProvider implements IHashProvider {
  async hash(plain: string) { return `hashed:${plain}` }
  async compare(plain: string, hashed: string) { return hashed === `hashed:${plain}` }
}

const PURPOSE: Record<PasswordTokenType, string> = {
  FIRST_ACCESS: 'first-access',
  RECOVERY: 'password-reset',
}
const ONE_HOUR = 60 * 60 * 1000
const NEW_PASSWORD = 'NovaSenha@123'

describe('SetPasswordUseCase', () => {
  let usersRepository: InMemoryUsersRepository
  let passwordTokensRepository: InMemoryPasswordTokensRepository
  let refreshTokensRepository: InMemoryRefreshTokensRepository
  let sut: SetPasswordUseCase

  beforeEach(() => {
    env.JWT_SECRET = 'test-jwt-secret'
    env.PASSWORD_RESET_SECRET = 'test-reset-secret'

    usersRepository = new InMemoryUsersRepository()
    passwordTokensRepository = new InMemoryPasswordTokensRepository()
    refreshTokensRepository = new InMemoryRefreshTokensRepository()
    sut = new SetPasswordUseCase(
      usersRepository,
      passwordTokensRepository,
      refreshTokensRepository,
      new FakeHashProvider(),
    )
  })

  function createTutor() {
    return usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'hash-inicial',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })
  }

  async function issueToken(userId: string, type: PasswordTokenType, expiresAt = new Date(Date.now() + ONE_HOUR)) {
    const token = jwt.sign(
      { sub: userId, purpose: PURPOSE[type], jti: randomUUID() },
      env.PASSWORD_RESET_SECRET,
      { expiresIn: '1h' },
    )
    await passwordTokensRepository.create(userId, token, expiresAt, type)
    return token
  }

  it('deve definir a senha, consumir o convite e revogar sessões ativas', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS')
    const expiresAt = new Date(Date.now() + ONE_HOUR)
    await refreshTokensRepository.create({ token: 'refresh-1', userId: tutor.id, expiresAt })

    await sut.execute({ token, newPassword: NEW_PASSWORD })

    expect(usersRepository.items[0].passwordHash).toBe(`hashed:${NEW_PASSWORD}`)
    expect(passwordTokensRepository.items[0].usedAt).toBeInstanceOf(Date)
    expect(refreshTokensRepository.items).toHaveLength(0)
  })

  it('deve invalidar outros tokens pendentes do usuário após definir a senha', async () => {
    const tutor = await createTutor()
    const pendingRecovery = await issueToken(tutor.id, 'RECOVERY')
    const invite = await issueToken(tutor.id, 'FIRST_ACCESS')

    await sut.execute({ token: invite, newPassword: NEW_PASSWORD })

    expect((await passwordTokensRepository.findByToken(pendingRecovery))?.usedAt).toBeInstanceOf(Date)
  })

  it('deve aceitar token de recuperação de senha', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'RECOVERY')

    await sut.execute({ token, newPassword: NEW_PASSWORD })

    expect(usersRepository.items[0].passwordHash).toBe(`hashed:${NEW_PASSWORD}`)
  })

  it('não deve permitir reutilizar o mesmo token', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS')
    await sut.execute({ token, newPassword: NEW_PASSWORD })

    await expect(
      sut.execute({ token, newPassword: 'OutraSenha@456' }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(usersRepository.items[0].passwordHash).toBe(`hashed:${NEW_PASSWORD}`)
  })

  it('deve lançar 404 quando o token não existe', async () => {
    await expect(
      sut.execute({ token: 'inexistente', newPassword: NEW_PASSWORD }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deve lançar 400 e manter a senha quando o token está expirado', async () => {
    const tutor = await createTutor()
    const token = await issueToken(tutor.id, 'FIRST_ACCESS', new Date(Date.now() - 1000))

    await expect(
      sut.execute({ token, newPassword: NEW_PASSWORD }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(usersRepository.items[0].passwordHash).toBe('hash-inicial')
  })

  it('deve lançar 404 sem consumir o token quando o usuário não existe', async () => {
    const token = await issueToken('usuario-removido', 'FIRST_ACCESS')

    await expect(
      sut.execute({ token, newPassword: NEW_PASSWORD }),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(passwordTokensRepository.items[0].usedAt).toBeNull()
  })
})
