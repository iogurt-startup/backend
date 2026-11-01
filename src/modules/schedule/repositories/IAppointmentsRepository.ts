import type { Appointment, Patient, User } from '@prisma/client'
import type { AppointmentCategory, AppointmentStatus } from '@prisma/client'

export type { AppointmentCategory, AppointmentStatus }

/**
 * Duração assumida para agendamentos sem horário de fim (endDateTime null).
 * Usada tanto no cálculo do fim padrão ao criar quanto na checagem de conflito,
 * para que ambos os lados concordem: um agendamento sem fim NÃO ocupa o horário
 * até o infinito — ocupa apenas esta janela padrão a partir do início.
 */
export const DEFAULT_APPOINTMENT_DURATION_MS = 15 * 60 * 1000

export type AppointmentWithRelations = Appointment & {
  patient: Pick<Patient, 'id' | 'name' | 'species' | 'clinicId' | 'photoUrl'>
  vet: Pick<User, 'id' | 'name'> | null
}

export type AppointmentReminderCandidate = Appointment & {
  patient: Pick<Patient, 'id' | 'name' | 'species' | 'clinicId'> & {
    tutor: {
      id: string
      fullName: string
      email: string | null
    }
    clinic: {
      id: string
      name: string
      phone: string | null
      address: string | null
    }
  }
  vet: Pick<User, 'id' | 'name'> | null
}

export interface CreateAppointmentDTO {
  patientId: string
  vetId?: string
  dateTime: Date
  endDateTime?: Date
  category: AppointmentCategory
  observation?: string
}

export interface IAppointmentsRepository {
  create(data: CreateAppointmentDTO): Promise<Appointment>
  findById(id: string, clinicId: string): Promise<Appointment | null>
  findConflict(vetId: string, dateTime: Date, endDateTime: Date, excludeId?: string): Promise<Appointment | null>
  listByDay(date: Date, clinicId: string, vetId?: string): Promise<AppointmentWithRelations[]>
  listByStatus(status: AppointmentStatus, clinicId: string, date?: Date): Promise<AppointmentWithRelations[]>
  updateStatus(id: string, status: AppointmentStatus, endDateTime?: Date): Promise<Appointment>
  cancel(id: string, reason: string): Promise<Appointment>
  reschedule(id: string, newDateTime: Date, newEndDateTime?: Date): Promise<Appointment>
  approve(id: string, vetId: string, endDateTime: Date): Promise<AppointmentWithRelations>
  reject(id: string, reason: string): Promise<AppointmentWithRelations>
  findPendingReminders(windowStart: Date, windowEnd: Date): Promise<AppointmentReminderCandidate[]>
  markReminderSent(id: string, sentAt: Date): Promise<Appointment>
}
