import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { env } from '../../../config/env'
import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type { IPasswordTokensRepository } from '../repositories/IPasswordTokensRepository'
import type { ResendMailProvider } from '../infra/providers/ResendMailProvider'

export class SendForgotPasswordMailUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private passwordTokensRepository: IPasswordTokensRepository,
    private mailProvider: ResendMailProvider,
  ) {}

  async execute({ email }: { email: string }): Promise<void> {
    const user = await this.usersRepository.findByEmail(email.toLowerCase().trim())

    if (!user) return
    this.mailProvider.assertConfigured()
    if (!env.PASSWORD_RESET_SECRET) {
      throw Errors.serviceUnavailable('Recuperação de senha indisponível no momento.')
    }

    await this.passwordTokensRepository.invalidatePreviousTokens(user.id, 'RECOVERY')

    // jti evita tokens idênticos (e violação do unique) em pedidos no mesmo segundo
    const token = jwt.sign(
      { sub: user.id, purpose: 'password-reset', jti: randomUUID() },
      env.PASSWORD_RESET_SECRET,
      { expiresIn: '2h' },
    )

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 2)

    await this.passwordTokensRepository.create(user.id, token, expiresAt, 'RECOVERY')

    const baseUrl = env.FRONTEND_URL.replace(/\/$/, '')
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    // TO-DO: Rever o template do email enviado

    await this.mailProvider.sendMail({
      to: user.email,
      subject: '[IOUGURT] Recuperação de Senha',
      html: `<p>Olá, ${user.name}! Use este link: <a href="${resetUrl}">Redefinir Senha</a></p>`,
    })
  }
}
