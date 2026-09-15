import { PrismaUsersRepository } from '../../infra/repositories/PrismaUsersRepository'
import { PrismaPasswordTokensRepository } from '../../infra/repositories/PrismaPasswordTokensRepository'
import { VerifyPasswordTokenUseCase } from '../verifyPasswordTokenUseCase'

export function makeVerifyPasswordTokenUseCase() {
  return new VerifyPasswordTokenUseCase(
    new PrismaUsersRepository(),
    new PrismaPasswordTokensRepository(),
  )
}
