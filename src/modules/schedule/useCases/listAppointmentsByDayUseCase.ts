import type { IAppointmentsRepository, AppointmentWithRelations } from '../repositories/IAppointmentsRepository'

interface ListByDayInput { date: string; clinicId: string; vetId?: string; tzOffsetMinutes?: number }

export class ListAppointmentsByDayUseCase {
  constructor(private appointmentsRepository: IAppointmentsRepository) {}

  async execute({ date, clinicId, vetId, tzOffsetMinutes }: ListByDayInput): Promise<AppointmentWithRelations[]> {
    return this.appointmentsRepository.listByDay(new Date(date), clinicId, vetId, tzOffsetMinutes)
  }
}
