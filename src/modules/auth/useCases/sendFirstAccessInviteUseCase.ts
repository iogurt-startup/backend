import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { env } from '../../../config/env'
import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type { IPasswordTokensRepository } from '../repositories/IPasswordTokensRepository'
import type { IMailProvider } from '../providers/IMailProvider'
import { renderFirstAccessEmail } from '../templates/firstAccessEmailTemplate'

export interface SendFirstAccessInviteRequest {
  userId: string
  clinicName?: string
}

export interface SendFirstAccessInviteResponse {
  token: string
  firstAccessUrl: string
}

export class SendFirstAccessInviteUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private passwordTokensRepository: IPasswordTokensRepository,
    private mailProvider: IMailProvider,
  ) {}

  async execute({
    userId,
    clinicName,
  }: SendFirstAccessInviteRequest): Promise<SendFirstAccessInviteResponse> {
    const user = await this.usersRepository.findById(userId)

    if (!user) {
      throw Errors.notFound('Usuário não encontrado.')
    }

    if (!user.email) {
      throw Errors.badRequest('Usuário não possui e-mail cadastrado.')
    }

    const secret = env.PASSWORD_RESET_SECRET || env.JWT_SECRET

    // 1. Invalidação prévia de tokens pendentes do mesmo tutor
    await this.passwordTokensRepository.invalidatePreviousTokens(user.id, 'FIRST_ACCESS')

    // 2. Geração do token JWT com payload específico de primeiro acesso e jti único
    const token = jwt.sign(
      {
        sub: user.id,
        purpose: 'first-access',
        jti: randomUUID(),
      },
      secret,
      { expiresIn: '48h' },
    )

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    // 3. Persistência do novo token
    await this.passwordTokensRepository.create(user.id, token, expiresAt, 'FIRST_ACCESS')

    // 4. Construção da URL de Primeiro Acesso
    const baseUrl = env.FRONTEND_URL.replace(/\/$/, '')
    const firstAccessUrl = `${baseUrl}/primeiro-acesso?token=${token}`

    // 5. Renderização do template HTML
    const html = renderFirstAccessEmail({
      tutorName: user.name,
      firstAccessUrl,
      clinicName,
    })

    // 6. Disparo resiliente do e-mail
    await this.mailProvider.sendMail({
      to: user.email,
      subject: '[IOUGURT] Bem-vindo ao Portal do Tutor — Defina sua senha',
      html,
    })

    return {
      token,
      firstAccessUrl,
    }
  }
}
