import { PrismaUsersRepository } from '../../../auth/infra/repositories/PrismaUsersRepository'
import { PrismaAppointmentsRepository } from '../../infra/repositories/PrismaAppointmentsRepository'
import { UpdateAppointmentUseCase } from '../updateAppointmentUseCase'

export function makeUpdateAppointmentUseCase() {
  return new UpdateAppointmentUseCase(
    new PrismaAppointmentsRepository(),
    new PrismaUsersRepository(),
  )
}
