import type { FastifyBaseLogger } from 'fastify'
import { CreateTutorAccountUseCase } from '../createTutorAccountUseCase'
import { makeSendFirstAccessInviteUseCase } from '../../../auth/useCases/factories/makeSendFirstAccessInviteUseCase'

export function makeCreateTutorAccountUseCase(logger?: FastifyBaseLogger) {
  const sendFirstAccessInviteUseCase = makeSendFirstAccessInviteUseCase(logger)
  return new CreateTutorAccountUseCase(sendFirstAccessInviteUseCase)
}
