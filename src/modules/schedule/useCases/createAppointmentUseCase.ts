import { Errors } from '../../../core/errors'
import type { IAppointmentsRepository, CreateAppointmentDTO } from '../repositories/IAppointmentsRepository'
import type { IPatientsRepository } from '../../patient/repositories/IPatientsRepository'
import type { IUsersRepository } from '../../auth/repositories/IUsersRepository'
import type { Appointment } from '@prisma/client'

export class CreateAppointmentUseCase {
  constructor(
    private appointmentsRepository: IAppointmentsRepository,
    private patientsRepository: IPatientsRepository,
    private usersRepository: IUsersRepository,
  ) {}

  async execute(input: CreateAppointmentDTO): Promise<Appointment> {
    const [patient, vet] = await Promise.all([
      this.patientsRepository.findById(input.patientId),
      this.usersRepository.findById(input.vetId),
    ])

    if (!patient) throw Errors.notFound('Paciente não encontrado')
    if (!vet) throw Errors.notFound('Veterinário não encontrado')

    if (input.endDateTime && input.endDateTime <= input.dateTime) {
      throw Errors.badRequest('O horário de fim deve ser posterior ao horário de início.')
    }

    return this.appointmentsRepository.create(input)
  }
}
