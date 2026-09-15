import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryUsersRepository } from '../repositories/in-memory/InMemoryUsersRepository'
import { InMemoryRefreshTokensRepository } from '../repositories/in-memory/InMemoryRefreshTokensRepository'
import type { IHashProvider } from '../providers/IHashProvider'
import { InMemoryPasswordTokensRepository } from '../repositories/in-memory/InMemoryPasswordTokensRepository'

class FakeHashProvider implements IHashProvider {
  async hash(plain: string) { return `hashed:${plain}` }
  async compare(plain: string, hashed: string) { return hashed === `hashed:${plain}` }
}

describe('ResetPasswordUseCase', () => {
  let usersRepository: InMemoryUsersRepository
  let refreshTokensRepository: InMemoryRefreshTokensRepository
  let passwordTokensRepository: InMemoryPasswordTokensRepository
  let ResetPasswordUseCase: typeof import('./resetPasswordUseCase').ResetPasswordUseCase

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgresql://iougurt:iougurt@localhost:5432/iougurt?schema=public'
    process.env.JWT_SECRET = 'access-secret'
    process.env.PASSWORD_RESET_SECRET = 'password-reset-secret'

    vi.resetModules()
    ;({ ResetPasswordUseCase } = await import('./resetPasswordUseCase'))

    usersRepository = new InMemoryUsersRepository()
    refreshTokensRepository = new InMemoryRefreshTokensRepository()
    passwordTokensRepository = new InMemoryPasswordTokensRepository()
  })

  it('deve redefinir a senha, marcar token como usado e revogar refresh tokens ativos', async () => {
    const user = await usersRepository.create({
      name: 'Dr. Gustavo',
      email: 'gustavo@iougurt.com',
      passwordHash: 'old-hash',
      role: 'OWNER',
      clinicId: 'clinic-1',
    })
    const resetToken = jwt.sign(
      { sub: user.id, purpose: 'password-reset' },
      process.env.PASSWORD_RESET_SECRET!,
      { expiresIn: '2h' },
    )
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 2)
    await passwordTokensRepository.create(user.id, resetToken, expiresAt, 'RECOVERY')
    await refreshTokensRepository.create({ token: 'refresh-1', userId: user.id, expiresAt })
    await refreshTokensRepository.create({ token: 'refresh-2', userId: user.id, expiresAt })

    const sut = new ResetPasswordUseCase(
      usersRepository,
      passwordTokensRepository,
      refreshTokensRepository,
      new FakeHashProvider(),
    )

    await sut.execute({ token: resetToken, newPassword: 'nova-senha-123' })

    expect(usersRepository.items[0].passwordHash).toBe('hashed:nova-senha-123')
    expect(refreshTokensRepository.items).toHaveLength(0)
    expect(passwordTokensRepository.items[0].usedAt).toBeInstanceOf(Date)
  })

  it('deve redefinir a senha de um tutor', async () => {
    const tutor = await usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'old-hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })
    const resetToken = jwt.sign(
      { sub: tutor.id, purpose: 'password-reset' },
      process.env.PASSWORD_RESET_SECRET!,
      { expiresIn: '2h' },
    )
    await passwordTokensRepository.create(tutor.id, resetToken, new Date(Date.now() + 60 * 60 * 1000), 'RECOVERY')

    const sut = new ResetPasswordUseCase(
      usersRepository,
      passwordTokensRepository,
      refreshTokensRepository,
      new FakeHashProvider(),
    )

    await sut.execute({ token: resetToken, newPassword: 'nova-senha-123' })

    expect(usersRepository.items[0].passwordHash).toBe('hashed:nova-senha-123')
  })

  it('deve rejeitar token de primeiro acesso no fluxo de recuperação', async () => {
    const tutor = await usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'old-hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })
    const inviteToken = jwt.sign(
      { sub: tutor.id, purpose: 'first-access' },
      process.env.PASSWORD_RESET_SECRET!,
      { expiresIn: '48h' },
    )
    await passwordTokensRepository.create(tutor.id, inviteToken, new Date(Date.now() + 60 * 60 * 1000), 'FIRST_ACCESS')

    const sut = new ResetPasswordUseCase(
      usersRepository,
      passwordTokensRepository,
      refreshTokensRepository,
      new FakeHashProvider(),
    )

    await expect(
      sut.execute({ token: inviteToken, newPassword: 'nova-senha-123' })
    ).rejects.toMatchObject({ statusCode: 401 })
    expect(usersRepository.items[0].passwordHash).toBe('old-hash')
  })

  it('deve rejeitar token assinado com o secret de access token', async () => {
    const user = await usersRepository.create({
      name: 'Dr. Gustavo',
      email: 'gustavo@iougurt.com',
      passwordHash: 'old-hash',
      role: 'OWNER',
      clinicId: 'clinic-1',
    })
    const invalidToken = jwt.sign(
      { sub: user.id, purpose: 'password-reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '2h' },
    )
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 2)
    await passwordTokensRepository.create(user.id, invalidToken, expiresAt, 'RECOVERY')

    const sut = new ResetPasswordUseCase(
      usersRepository,
      passwordTokensRepository,
      refreshTokensRepository,
      new FakeHashProvider(),
    )

    await expect(
      sut.execute({ token: invalidToken, newPassword: 'nova-senha-123' })
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
