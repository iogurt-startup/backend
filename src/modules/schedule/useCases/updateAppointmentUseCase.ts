import type { Appointment } from '@prisma/client'
import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../../auth/repositories/IUsersRepository'
import {
  DEFAULT_APPOINTMENT_DURATION_MS,
  type IAppointmentsRepository,
  type UpdateAppointmentDTO,
} from '../repositories/IAppointmentsRepository'

interface UpdateAppointmentRequest extends UpdateAppointmentDTO {
  appointmentId: string
  clinicId: string
}

export class UpdateAppointmentUseCase {
  constructor(
    private appointmentsRepository: IAppointmentsRepository,
    private usersRepository: IUsersRepository,
  ) {}

  async execute({ appointmentId, clinicId, ...data }: UpdateAppointmentRequest): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findById(appointmentId, clinicId)
    if (!appointment) throw Errors.notFound('Atendimento nÃ£o encontrado')
    if (appointment.status !== 'SCHEDULED') {
      throw Errors.conflict('Apenas atendimentos agendados podem ser editados.')
    }

    if (data.vetId && data.vetId !== appointment.vetId) {
      const vet = await this.usersRepository.findById(data.vetId)
      if (!vet || vet.clinicId !== clinicId || !['OWNER', 'VET'].includes(vet.role)) {
        throw Errors.notFound('VeterinÃ¡rio nÃ£o encontrado')
      }
    }

    const dateTime = data.dateTime ?? appointment.dateTime
    const endDateTime = data.endDateTime === undefined ? appointment.endDateTime : data.endDateTime
    if (data.dateTime && dateTime <= new Date()) {
      throw Errors.badRequest('A nova data deve ser no futuro.')
    }
    if (endDateTime && endDateTime <= dateTime) {
      throw Errors.badRequest('O horÃ¡rio de fim deve ser posterior ao horÃ¡rio de inÃ­cio.')
    }

    const vetId = data.vetId ?? appointment.vetId
    const scheduleChanged = data.vetId !== undefined || data.dateTime !== undefined || data.endDateTime !== undefined
    if (scheduleChanged) {
      if (!vetId) throw Errors.badRequest('Atendimento sem veterinÃ¡rio atribuÃ­do.')
      const effectiveEnd = endDateTime ?? new Date(dateTime.getTime() + DEFAULT_APPOINTMENT_DURATION_MS)
      const conflict = await this.appointmentsRepository.findConflict(vetId, dateTime, effectiveEnd, appointmentId)
      if (conflict) throw Errors.conflict('Este horÃ¡rio jÃ¡ estÃ¡ ocupado.')
    }

    return this.appointmentsRepository.update(appointmentId, data)
  }
}
