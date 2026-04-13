import { prisma } from '../../../../config/prisma'
import type {
  IAppointmentsRepository,
  CreateAppointmentDTO,
  AppointmentWithRelations,
} from '../../repositories/IAppointmentsRepository'
import { type Appointment, AppointmentStatus } from '@prisma/client'

const withRelations = {
  patient: { select: { id: true, name: true, species: true } },
  vet: { select: { id: true, name: true } },
} as const

export class PrismaAppointmentsRepository implements IAppointmentsRepository {
  async create(data: CreateAppointmentDTO): Promise<Appointment> {
    return prisma.appointment.create({ data })
  }

  async findById(id: string): Promise<Appointment | null> {
    return prisma.appointment.findUnique({ where: { id } })
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    return prisma.appointment.update({ where: { id }, data: { status } })
  }

  async listByDay(date: Date, vetId?: string): Promise<AppointmentWithRelations[]> {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    return prisma.appointment.findMany({
      where: {
        dateTime: { gte: start, lte: end },
        status: { not: AppointmentStatus.CANCELLED },
        ...(vetId && { vetId }),
      },
      include: withRelations,
      orderBy: { dateTime: 'asc' },
    })
  }
  async cancel(id: string, reason: string): Promise<Appointment> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    })
  }

  async reschedule(id: string, newDateTime: Date, newEndDateTime?: Date): Promise<Appointment> {
    return prisma.appointment.update({
      where: { id },
      data: {
        dateTime: newDateTime,
        ...(newEndDateTime !== undefined && { endDateTime: newEndDateTime }),
      },
    })
  }
}
