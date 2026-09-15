import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'
import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type { IPasswordTokensRepository } from '../repositories/IPasswordTokensRepository'
import type { IRefreshTokensRepository } from '../repositories/IRefreshTokensRepository'
import type { IHashProvider } from '../providers/IHashProvider'

export class ResetPasswordUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private passwordTokensRepository: IPasswordTokensRepository,
    private refreshTokensRepository: IRefreshTokensRepository,
    private hashProvider: IHashProvider,
  ) {}

  async execute({ token, newPassword }: { token: string, newPassword: string }): Promise<void> {
    const storedToken = await this.passwordTokensRepository.findByToken(token)

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt < new Date()) {
      throw Errors.unauthorized('Token inválido, expirado ou já utilizado')
    }

    if (!env.PASSWORD_RESET_SECRET) {
      throw Errors.serviceUnavailable('Recuperação de senha indisponível no momento.')
    }

    try {
      const payload = jwt.verify(token, env.PASSWORD_RESET_SECRET)

      if (
        typeof payload !== 'object' ||
        payload.sub !== storedToken.userId ||
        payload.purpose !== 'password-reset'
      ) {
        throw Errors.unauthorized('Token corrompido ou expirado')
      }
    } catch {
      throw Errors.unauthorized('Token corrompido ou expirado')
    }

    const passwordHash = await this.hashProvider.hash(newPassword)

    const claimed = await this.passwordTokensRepository.markAsUsed(token)
    if (!claimed) {
      throw Errors.unauthorized('Token inválido, expirado ou já utilizado')
    }

    await this.usersRepository.updatePassword(storedToken.userId, passwordHash)
    await this.refreshTokensRepository.deleteAllByUserId(storedToken.userId)
  }
}
