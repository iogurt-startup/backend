import { randomUUID } from 'crypto'
import type { Appointment } from '@prisma/client'
import { AppointmentStatus } from '@prisma/client'
import type {
  IAppointmentsRepository,
  CreateAppointmentDTO,
  AppointmentWithRelations,
  AppointmentReminderCandidate,
} from '../IAppointmentsRepository'
import { DEFAULT_APPOINTMENT_DURATION_MS } from '../IAppointmentsRepository'

export type InMemoryAppointmentItem = AppointmentWithRelations & {
  patient: AppointmentWithRelations['patient'] & {
    deletedAt?: Date | null
    tutor?: {
      id: string
      fullName: string
      email: string | null
      deletedAt?: Date | null
    }
    clinic?: {
      id: string
      name: string
      phone: string | null
      address: string | null
    }
  }
}

export class InMemoryAppointmentsRepository implements IAppointmentsRepository {
  public items: InMemoryAppointmentItem[] = []

  async create(data: CreateAppointmentDTO): Promise<Appointment> {
    const appointment: InMemoryAppointmentItem = {
      id: randomUUID(),
      patientId: data.patientId,
      vetId: data.vetId ?? null,
      dateTime: data.dateTime,
      endDateTime: data.endDateTime ?? null,
      category: data.category,
      status: (data as { status?: AppointmentStatus }).status ?? AppointmentStatus.SCHEDULED,
      observation: data.observation ?? null,
      cancelReason: null,
      reminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: {
        id: data.patientId,
        name: 'Paciente',
        species: 'Cachorro',
        clinicId: 'clinic-1',
        photoUrl: null,
        deletedAt: null,
        tutor: {
          id: 'tutor-1',
          fullName: 'Tutor Padrão',
          email: 'tutor@iougurt.com',
          deletedAt: null,
        },
        clinic: {
          id: 'clinic-1',
          name: 'Clínica IOUGURT',
          phone: '11999999999',
          address: 'Rua das Flores, 123',
        },
      },
      vet: data.vetId ? { id: data.vetId, name: 'Veterinário' } : null,
    }
    this.items.push(appointment)
    return appointment
  }

  async findById(id: string, clinicId: string): Promise<Appointment | null> {
    return this.items.find(a => a.id === id && a.patient.clinicId === clinicId) ?? null
  }

  async updateStatus(id: string, status: AppointmentStatus, endDateTime?: Date): Promise<Appointment> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].status = status
    if (endDateTime !== undefined) {
      this.items[index].endDateTime = endDateTime
    }
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }

  async findConflict(vetId: string, dateTime: Date, endDateTime: Date, excludeId?: string): Promise<Appointment | null> {
    return this.items.find(a =>
      a.vetId === vetId &&
      (a.status === AppointmentStatus.SCHEDULED || a.status === AppointmentStatus.IN_PROGRESS) &&
      (!excludeId || a.id !== excludeId) &&
      a.dateTime < endDateTime &&
      (a.endDateTime === null
        ? a.dateTime.getTime() + DEFAULT_APPOINTMENT_DURATION_MS > dateTime.getTime()
        : a.endDateTime > dateTime)
    ) ?? null
  }

  async listByDay(date: Date, clinicId: string, vetId?: string): Promise<AppointmentWithRelations[]> {
    const dateStr = date.toISOString().slice(0, 10) // 'YYYY-MM-DD'
    return this.items.filter(a => {
      const aDateStr = a.dateTime.toISOString().slice(0, 10)
      return (
        aDateStr === dateStr &&
        a.patient.clinicId === clinicId &&
        (a.status === AppointmentStatus.SCHEDULED || a.status === AppointmentStatus.IN_PROGRESS || a.status === AppointmentStatus.COMPLETED) &&
        (!vetId || a.vetId === vetId)
      )
    })
  }

  async listByStatus(status: AppointmentStatus, clinicId: string, date?: Date): Promise<AppointmentWithRelations[]> {
    const dateStr = date?.toISOString().slice(0, 10)
    return this.items
      .filter(a =>
        a.status === status &&
        a.patient.clinicId === clinicId &&
        (!dateStr || a.dateTime.toISOString().slice(0, 10) === dateStr)
      )
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
  }

  async approve(id: string, vetId: string, endDateTime: Date): Promise<AppointmentWithRelations> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].status = AppointmentStatus.SCHEDULED
    this.items[index].vetId = vetId
    this.items[index].vet = { id: vetId, name: 'Veterinário' }
    this.items[index].endDateTime = endDateTime
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }

  async reject(id: string, reason: string): Promise<AppointmentWithRelations> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].status = AppointmentStatus.REJECTED
    this.items[index].cancelReason = reason
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }

  async cancel(id: string, reason: string): Promise<Appointment> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].status = AppointmentStatus.CANCELLED
    this.items[index].cancelReason = reason
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }

  async reschedule(id: string, newDateTime: Date, newEndDateTime?: Date): Promise<Appointment> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].dateTime = newDateTime
    this.items[index].reminderSentAt = null
    if (newEndDateTime !== undefined) {
      this.items[index].endDateTime = newEndDateTime
    }
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }

  async findPendingReminders(windowStart: Date, windowEnd: Date): Promise<AppointmentReminderCandidate[]> {
    return this.items
      .filter(a => {
        const tutor = a.patient.tutor
        return (
          a.status === AppointmentStatus.SCHEDULED &&
          a.reminderSentAt === null &&
          a.dateTime >= windowStart &&
          a.dateTime <= windowEnd &&
          !a.patient.deletedAt &&
          tutor &&
          !tutor.deletedAt &&
          Boolean(tutor.email)
        )
      })
      .map(a => ({
        ...a,
        patient: {
          id: a.patient.id,
          name: a.patient.name,
          species: a.patient.species,
          clinicId: a.patient.clinicId,
          tutor: {
            id: a.patient.tutor!.id,
            fullName: a.patient.tutor!.fullName,
            email: a.patient.tutor!.email,
          },
          clinic: a.patient.clinic ?? {
            id: a.patient.clinicId,
            name: 'Clínica IOUGURT',
            phone: null,
            address: null,
          },
        },
      }))
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
  }

  async markReminderSent(id: string, sentAt: Date): Promise<Appointment> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].reminderSentAt = sentAt
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }
}
