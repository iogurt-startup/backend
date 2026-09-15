import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryUsersRepository } from '../repositories/in-memory/InMemoryUsersRepository'
import { InMemoryPasswordTokensRepository } from '../repositories/in-memory/InMemoryPasswordTokensRepository'

class FakeMailProvider {
  public sentMessages: Array<{ to: string; subject: string; html: string }> = []

  assertConfigured(): void {}

  async sendMail(message: { to: string; subject: string; html: string }): Promise<void> {
    this.sentMessages.push(message)
  }
}

describe('SendForgotPasswordMailUseCase', () => {
  let usersRepository: InMemoryUsersRepository
  let passwordTokensRepository: InMemoryPasswordTokensRepository
  let mailProvider: FakeMailProvider
  let SendForgotPasswordMailUseCase: typeof import('./sendForgotPasswordMailUseCase').SendForgotPasswordMailUseCase

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgresql://iougurt:iougurt@localhost:5432/iougurt?schema=public'
    process.env.JWT_SECRET = 'access-secret'
    process.env.PASSWORD_RESET_SECRET = 'password-reset-secret'
    process.env.FRONTEND_URL = 'http://localhost:5173'

    vi.resetModules()
    ;({ SendForgotPasswordMailUseCase } = await import('./sendForgotPasswordMailUseCase'))

    usersRepository = new InMemoryUsersRepository()
    passwordTokensRepository = new InMemoryPasswordTokensRepository()
    mailProvider = new FakeMailProvider()
  })

  function makeSut() {
    return new SendForgotPasswordMailUseCase(
      usersRepository,
      passwordTokensRepository,
      mailProvider as never,
    )
  }

  it('deve gerar token com secret exclusivo e purpose de reset de senha', async () => {
    const user = await usersRepository.create({
      name: 'Dr. Gustavo',
      email: 'gustavo@iougurt.com',
      passwordHash: 'hash',
      role: 'OWNER',
      clinicId: 'clinic-1',
    })

    await makeSut().execute({ email: user.email })

    expect(passwordTokensRepository.items).toHaveLength(1)
    expect(passwordTokensRepository.items[0].type).toBe('RECOVERY')
    expect(mailProvider.sentMessages).toHaveLength(1)

    const payload = jwt.verify(
      passwordTokensRepository.items[0].token,
      process.env.PASSWORD_RESET_SECRET!,
    )

    expect(typeof payload).toBe('object')
    expect(payload).toMatchObject({
      sub: user.id,
      purpose: 'password-reset',
    })
  })

  it('deve enviar e-mail de recuperação para tutor com link do frontend', async () => {
    const tutor = await usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })

    await makeSut().execute({ email: '  CARLOS@exemplo.com ' })

    const [storedToken] = passwordTokensRepository.items
    expect(storedToken).toMatchObject({ userId: tutor.id, type: 'RECOVERY' })

    expect(mailProvider.sentMessages).toHaveLength(1)
    expect(mailProvider.sentMessages[0].to).toBe('carlos@exemplo.com')
    expect(mailProvider.sentMessages[0].html).toContain(
      `http://localhost:5173/reset-password?token=${storedToken.token}`,
    )
  })

  it('deve invalidar pedidos de recuperação anteriores sem afetar o convite de primeiro acesso', async () => {
    const tutor = await usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })
    await passwordTokensRepository.create(tutor.id, 'convite-pendente', new Date(Date.now() + 60_000), 'FIRST_ACCESS')

    await makeSut().execute({ email: tutor.email })
    await makeSut().execute({ email: tutor.email })

    const recoveryTokens = passwordTokensRepository.items.filter(item => item.type === 'RECOVERY')
    expect(recoveryTokens).toHaveLength(2)
    expect(recoveryTokens[0].token).not.toBe(recoveryTokens[1].token)
    expect(recoveryTokens[0].usedAt).toBeInstanceOf(Date)
    expect(recoveryTokens[1].usedAt).toBeNull()
    expect((await passwordTokensRepository.findByToken('convite-pendente'))?.usedAt).toBeNull()
  })

  it('nao deve criar token nem enviar email para usuario inexistente', async () => {
    await makeSut().execute({ email: 'naoexiste@iougurt.com' })

    expect(passwordTokensRepository.items).toHaveLength(0)
    expect(mailProvider.sentMessages).toHaveLength(0)
  })
})
