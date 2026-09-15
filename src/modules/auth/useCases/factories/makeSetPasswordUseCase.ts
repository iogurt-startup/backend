import { PrismaUsersRepository } from '../../infra/repositories/PrismaUsersRepository'
import { PrismaPasswordTokensRepository } from '../../infra/repositories/PrismaPasswordTokensRepository'
import { PrismaRefreshTokensRepository } from '../../infra/repositories/PrismaRefreshTokensRepository'
import { BcryptHashProvider } from '../../infra/providers/BcryptHashProvider'
import { SetPasswordUseCase } from '../setPasswordUseCase'

export function makeSetPasswordUseCase() {
  return new SetPasswordUseCase(
    new PrismaUsersRepository(),
    new PrismaPasswordTokensRepository(),
    new PrismaRefreshTokensRepository(),
    new BcryptHashProvider(),
  )
}
