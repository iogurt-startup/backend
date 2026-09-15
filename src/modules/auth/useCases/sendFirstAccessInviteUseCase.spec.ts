import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryUsersRepository } from '../repositories/in-memory/InMemoryUsersRepository'
import { InMemoryPasswordTokensRepository } from '../repositories/in-memory/InMemoryPasswordTokensRepository'
import type { IMailProvider, SendMailData } from '../providers/IMailProvider'
import { SendFirstAccessInviteUseCase } from './sendFirstAccessInviteUseCase'
import { env } from '../../../config/env'
import { AppError } from '../../../shared/errors/app-error'

class FakeMailProvider implements IMailProvider {
  public sentMessages: SendMailData[] = []
  public shouldFail = false

  async sendMail(data: SendMailData): Promise<void> {
    if (this.shouldFail) {
      // Simula comportamento do Resend resiliente (não explode erro não tratado)
      return
    }
    this.sentMessages.push(data)
  }
}

describe('SendFirstAccessInviteUseCase', () => {
  let usersRepository: InMemoryUsersRepository
  let passwordTokensRepository: InMemoryPasswordTokensRepository
  let mailProvider: FakeMailProvider
  let sut: SendFirstAccessInviteUseCase

  beforeEach(() => {
    usersRepository = new InMemoryUsersRepository()
    passwordTokensRepository = new InMemoryPasswordTokensRepository()
    mailProvider = new FakeMailProvider()

    env.JWT_SECRET = 'test-jwt-secret'
    env.PASSWORD_RESET_SECRET = 'test-reset-secret'
    env.FRONTEND_URL = 'http://localhost:5173'

    sut = new SendFirstAccessInviteUseCase(
      usersRepository,
      passwordTokensRepository,
      mailProvider,
    )
  })

  it('deve gerar token de primeiro acesso, persistir e disparar e-mail com a URL correta', async () => {
    const user = await usersRepository.create({
      name: 'Carlos Tutor',
      email: 'carlos@exemplo.com',
      passwordHash: 'hash123',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })

    const result = await sut.execute({
      userId: user.id,
      clinicName: 'Clínica IOUGURT',
    })

    expect(result.token).toBeDefined()
    expect(result.firstAccessUrl).toBe(`http://localhost:5173/primeiro-acesso?token=${result.token}`)

    // Verifica persistência no repositório de tokens
    expect(passwordTokensRepository.items).toHaveLength(1)
    const storedToken = passwordTokensRepository.items[0]
    expect(storedToken.token).toBe(result.token)
    expect(storedToken.userId).toBe(user.id)
    expect(storedToken.type).toBe('FIRST_ACCESS')
    expect(storedToken.usedAt).toBeNull()

    // Verifica claims do JWT
    const decoded = jwt.verify(result.token, env.PASSWORD_RESET_SECRET) as { sub: string; purpose: string }
    expect(decoded.sub).toBe(user.id)
    expect(decoded.purpose).toBe('first-access')

    // Verifica e-mail enviado
    expect(mailProvider.sentMessages).toHaveLength(1)
    const sentEmail = mailProvider.sentMessages[0]
    expect(sentEmail.to).toBe('carlos@exemplo.com')
    expect(sentEmail.subject).toContain('Bem-vindo ao Portal do Tutor')
    expect(sentEmail.html).toContain('Carlos Tutor')
    expect(sentEmail.html).toContain('Clínica IOUGURT')
    expect(sentEmail.html).toContain(result.firstAccessUrl)
  })

  it('deve invalidar tokens pendentes anteriores do mesmo tutor antes de emitir um novo convite', async () => {
    const user = await usersRepository.create({
      name: 'Ana Tutora',
      email: 'ana@exemplo.com',
      passwordHash: 'hash123',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })

    // Emite o 1º convite
    const firstResult = await sut.execute({ userId: user.id })
    expect(passwordTokensRepository.items).toHaveLength(1)
    expect(passwordTokensRepository.items[0].token).toBe(firstResult.token)
    expect(passwordTokensRepository.items[0].usedAt).toBeNull()

    // Emite o 2º convite (ex: reenvio pela clínica)
    const secondResult = await sut.execute({ userId: user.id })
    expect(passwordTokensRepository.items).toHaveLength(2)

    // O 1º token agora deve estar invalidado (usedAt preenchido)
    const firstTokenInDb = await passwordTokensRepository.findByToken(firstResult.token)
    expect(firstTokenInDb?.usedAt).toBeInstanceOf(Date)

    // O 2º token deve estar ativo (usedAt nulo)
    const secondTokenInDb = await passwordTokensRepository.findByToken(secondResult.token)
    expect(secondTokenInDb?.usedAt).toBeNull()
  })

  it('não deve invalidar tokens de outros usuários', async () => {
    const user1 = await usersRepository.create({
      name: 'User 1',
      email: 'user1@exemplo.com',
      passwordHash: 'hash1',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })
    const user2 = await usersRepository.create({
      name: 'User 2',
      email: 'user2@exemplo.com',
      passwordHash: 'hash2',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })

    const invite1 = await sut.execute({ userId: user1.id })
    const invite2 = await sut.execute({ userId: user2.id })

    const tokenUser1 = await passwordTokensRepository.findByToken(invite1.token)
    const tokenUser2 = await passwordTokensRepository.findByToken(invite2.token)

    expect(tokenUser1?.usedAt).toBeNull()
    expect(tokenUser2?.usedAt).toBeNull()
  })

  it('deve lançar erro 404 caso o usuário não exista', async () => {
    await expect(
      sut.execute({ userId: 'usuario-inexistente' }),
    ).rejects.toThrow(AppError)

    await expect(
      sut.execute({ userId: 'usuario-inexistente' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Usuário não encontrado.',
    })

    expect(passwordTokensRepository.items).toHaveLength(0)
    expect(mailProvider.sentMessages).toHaveLength(0)
  })

  it('deve lançar erro 400 se o usuário não possuir e-mail', async () => {
    const user = await usersRepository.create({
      name: 'Sem Email',
      email: '',
      passwordHash: 'hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })

    await expect(
      sut.execute({ userId: user.id }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Usuário não possui e-mail cadastrado.',
    })
  })

  it('deve concluir a geração do convite mesmo que o disparo do e-mail encontre falha resiliente', async () => {
    mailProvider.shouldFail = true

    const user = await usersRepository.create({
      name: 'Resiliente Tutor',
      email: 'resiliente@exemplo.com',
      passwordHash: 'hash',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    })

    const result = await sut.execute({ userId: user.id })

    expect(result.token).toBeDefined()
    expect(passwordTokensRepository.items).toHaveLength(1)
  })
})
