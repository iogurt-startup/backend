import { randomUUID } from 'crypto'
import type { Appointment } from '@prisma/client'
import { AppointmentStatus } from '@prisma/client'
import type {
  IAppointmentsRepository,
  CreateAppointmentDTO,
  AppointmentWithRelations,
} from '../IAppointmentsRepository'

export class InMemoryAppointmentsRepository implements IAppointmentsRepository {
  public items: AppointmentWithRelations[] = []

  async create(data: CreateAppointmentDTO): Promise<Appointment> {
    const appointment: AppointmentWithRelations = {
      id: randomUUID(),
      patientId: data.patientId,
      vetId: data.vetId,
      dateTime: data.dateTime,
      endDateTime: data.endDateTime ?? null,
      category: data.category,
      status: AppointmentStatus.SCHEDULED,
      observation: data.observation ?? null,
      cancelReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: { id: data.patientId, name: 'Paciente', species: 'Cachorro' },
      vet: { id: data.vetId, name: 'Veterinário' },
    }
    this.items.push(appointment)
    return appointment
  }

  async findById(id: string): Promise<Appointment | null> {
    return this.items.find(a => a.id === id) ?? null
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const index = this.items.findIndex(a => a.id === id)
    this.items[index].status = status
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }

  async listByDay(date: Date, vetId?: string): Promise<AppointmentWithRelations[]> {
    const dateStr = date.toISOString().slice(0, 10) // 'YYYY-MM-DD'
    return this.items.filter(a => {
      const aDateStr = a.dateTime.toISOString().slice(0, 10)
      return (
        aDateStr === dateStr &&
        a.status !== AppointmentStatus.CANCELLED &&
        (!vetId || a.vetId === vetId)
      )
    })
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
    if (newEndDateTime !== undefined) {
      this.items[index].endDateTime = newEndDateTime
    }
    this.items[index].updatedAt = new Date()
    return this.items[index]
  }
}
