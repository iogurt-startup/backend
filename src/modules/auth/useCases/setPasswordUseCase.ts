import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type { IPasswordTokensRepository } from '../repositories/IPasswordTokensRepository'
import type { IRefreshTokensRepository } from '../repositories/IRefreshTokensRepository'
import type { IHashProvider } from '../providers/IHashProvider'
import { findValidPasswordToken } from './validatePasswordToken'

export interface SetPasswordRequest {
  token: string
  newPassword: string
}

export class SetPasswordUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private passwordTokensRepository: IPasswordTokensRepository,
    private refreshTokensRepository: IRefreshTokensRepository,
    private hashProvider: IHashProvider,
  ) {}

  async execute({ token, newPassword }: SetPasswordRequest): Promise<void> {
    const storedToken = await findValidPasswordToken(this.passwordTokensRepository, token)

    const user = await this.usersRepository.findById(storedToken.userId)
    if (!user) {
      throw Errors.notFound('Usuário não encontrado.')
    }

    const passwordHash = await this.hashProvider.hash(newPassword)

    // Consumo condicional: se duas requisições concorrentes usarem o mesmo token, só uma vence
    const claimed = await this.passwordTokensRepository.markAsUsed(token)
    if (!claimed) {
      throw Errors.badRequest('Token expirado ou já utilizado.')
    }

    await this.usersRepository.updatePassword(user.id, passwordHash)
    await this.passwordTokensRepository.invalidatePreviousTokens(user.id)
    await this.refreshTokensRepository.deleteAllByUserId(user.id)
  }
}
