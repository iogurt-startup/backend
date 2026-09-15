import type { FastifyBaseLogger } from 'fastify'
import { PrismaUsersRepository } from '../../infra/repositories/PrismaUsersRepository'
import { PrismaPasswordTokensRepository } from '../../infra/repositories/PrismaPasswordTokensRepository'
import { ResendMailProvider } from '../../infra/providers/ResendMailProvider'
import { SendFirstAccessInviteUseCase } from '../sendFirstAccessInviteUseCase'

export function makeSendFirstAccessInviteUseCase(logger?: FastifyBaseLogger) {
  return new SendFirstAccessInviteUseCase(
    new PrismaUsersRepository(),
    new PrismaPasswordTokensRepository(),
    new ResendMailProvider(logger),
  )
}
