import type { Role } from '@prisma/client'
import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type {
  IPasswordTokensRepository,
  PasswordTokenType,
} from '../repositories/IPasswordTokensRepository'
import { findValidPasswordToken } from './validatePasswordToken'

export interface VerifyPasswordTokenResponse {
  email: string
  type: PasswordTokenType
  role: Role
}

export class VerifyPasswordTokenUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private passwordTokensRepository: IPasswordTokensRepository,
  ) {}

  async execute({ token }: { token: string }): Promise<VerifyPasswordTokenResponse> {
    const storedToken = await findValidPasswordToken(this.passwordTokensRepository, token)

    const user = await this.usersRepository.findById(storedToken.userId)
    if (!user) {
      throw Errors.notFound('Usuário não encontrado.')
    }

    return {
      email: user.email,
      type: storedToken.type,
      role: user.role,
    }
  }
}
