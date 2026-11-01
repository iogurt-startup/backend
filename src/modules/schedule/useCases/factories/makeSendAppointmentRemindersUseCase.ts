import type { FastifyBaseLogger } from 'fastify'
import { ResendMailProvider } from '../../../auth/infra/providers/ResendMailProvider'
import { PrismaAppointmentsRepository } from '../../infra/repositories/PrismaAppointmentsRepository'
import { SendAppointmentRemindersUseCase } from '../sendAppointmentRemindersUseCase'

export function makeSendAppointmentRemindersUseCase(logger?: FastifyBaseLogger) {
  return new SendAppointmentRemindersUseCase(
    new PrismaAppointmentsRepository(),
    new ResendMailProvider(logger),
  )
}

