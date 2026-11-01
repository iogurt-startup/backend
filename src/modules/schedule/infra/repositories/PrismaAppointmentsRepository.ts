import { prisma } from '../../../../config/prisma'
import type {
  IAppointmentsRepository,
  CreateAppointmentDTO,
  AppointmentWithRelations,
  AppointmentReminderCandidate,
} from '../../repositories/IAppointmentsRepository'
import { DEFAULT_APPOINTMENT_DURATION_MS } from '../../repositories/IAppointmentsRepository'
import { type Appointment, AppointmentStatus } from '@prisma/client'

const withRelations = {
  patient: { select: { id: true, name: true, species: true, clinicId: true, photoUrl: true } },
  vet: { select: { id: true, name: true } },
} as const

export class PrismaAppointmentsRepository implements IAppointmentsRepository {
  async create(data: CreateAppointmentDTO): Promise<Appointment> {
    return prisma.appointment.create({ data })
  }

  async findById(id: string, clinicId: string): Promise<Appointment | null> {
    return prisma.appointment.findFirst({ where: { id, patient: { clinicId } } })
  }

  async updateStatus(id: string, status: AppointmentStatus, endDateTime?: Date): Promise<Appointment> {
    return prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(endDateTime !== undefined && { endDateTime }),
      },
    })
  }

  async findConflict(vetId: string, dateTime: Date, endDateTime: Date, excludeId?: string): Promise<Appointment | null> {
    return prisma.appointment.findFirst({
      where: {
        vetId,
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS] },
        ...(excludeId && { id: { not: excludeId } }),
        dateTime: { lt: endDateTime },
        OR: [
          { endDateTime: { gt: dateTime } },
          // Agendamento sem fim: assume duração padrão (igual ao create).
          // Só conflita se começou dentro da janela padrão antes do novo início,
          // em vez de bloquear todos os horários futuros para sempre.
          {
            endDateTime: null,
            dateTime: { gt: new Date(dateTime.getTime() - DEFAULT_APPOINTMENT_DURATION_MS) },
          },
        ],
      },
    })
  }

  async listByDay(date: Date, clinicId: string, vetId?: string): Promise<AppointmentWithRelations[]> {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    return prisma.appointment.findMany({
      where: {
        dateTime: { gte: start, lte: end },
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED] },
        patient: { clinicId },
        ...(vetId && { vetId }),
      },
      include: withRelations,
      orderBy: { dateTime: 'asc' },
    })
  }

  async listByStatus(status: AppointmentStatus, clinicId: string, date?: Date): Promise<AppointmentWithRelations[]> {
    let dayRange: { gte: Date, lte: Date } | undefined
    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      dayRange = { gte: start, lte: end }
    }

    return prisma.appointment.findMany({
      where: {
        status,
        patient: { clinicId },
        ...(dayRange && { dateTime: dayRange }),
      },
      include: withRelations,
      orderBy: { dateTime: 'asc' },
    })
  }

  async approve(id: string, vetId: string, endDateTime: Date): Promise<AppointmentWithRelations> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.SCHEDULED, vetId, endDateTime },
      include: withRelations,
    })
  }

  async reject(id: string, reason: string): Promise<AppointmentWithRelations> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.REJECTED, cancelReason: reason },
      include: withRelations,
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
        reminderSentAt: null,
        ...(newEndDateTime !== undefined && { endDateTime: newEndDateTime }),
      },
    })
  }

  async findPendingReminders(windowStart: Date, windowEnd: Date): Promise<AppointmentReminderCandidate[]> {
    return prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        reminderSentAt: null,
        dateTime: {
          gte: windowStart,
          lte: windowEnd,
        },
        patient: {
          deletedAt: null,
          tutor: {
            deletedAt: null,
            email: { not: null },
          },
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            clinicId: true,
            tutor: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            clinic: {
              select: {
                id: true,
                name: true,
                phone: true,
                address: true,
              },
            },
          },
        },
        vet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dateTime: 'asc' },
    })
  }

  async markReminderSent(id: string, sentAt: Date): Promise<Appointment> {
    return prisma.appointment.update({
      where: { id },
      data: { reminderSentAt: sentAt },
    })
  }
}
