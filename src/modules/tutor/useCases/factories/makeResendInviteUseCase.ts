import type { FastifyBaseLogger } from 'fastify'
import { ResendInviteUseCase } from '../resendInviteUseCase'
import { makeSendFirstAccessInviteUseCase } from '../../../auth/useCases/factories/makeSendFirstAccessInviteUseCase'

export function makeResendInviteUseCase(logger?: FastifyBaseLogger) {
  const sendFirstAccessInviteUseCase = makeSendFirstAccessInviteUseCase(logger)
  return new ResendInviteUseCase(sendFirstAccessInviteUseCase)
}
