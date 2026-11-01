import { env } from '../../../config/env'
import type { IMailProvider } from '../../auth/providers/IMailProvider'
import type { IAppointmentsRepository } from '../repositories/IAppointmentsRepository'
import { renderAppointmentReminderEmail } from '../templates/appointmentReminderEmailTemplate'

export interface SendAppointmentRemindersRequest {
  referenceDate?: Date
  windowHours?: number
}

export interface SendAppointmentRemindersResponse {
  totalFound: number
  sentCount: number
  failedCount: number
  skippedCount: number
}

export class SendAppointmentRemindersUseCase {
  constructor(
    private appointmentsRepository: IAppointmentsRepository,
    private mailProvider: IMailProvider,
  ) {}

  async execute(
    request: SendAppointmentRemindersRequest = {},
  ): Promise<SendAppointmentRemindersResponse> {
    const now = request.referenceDate ?? new Date()
    const windowHours = request.windowHours ?? 24
    const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

    const candidates = await this.appointmentsRepository.findPendingReminders(now, windowEnd)

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0

    const baseUrl = env.FRONTEND_URL.replace(/\/$/, '')
    const portalUrl = `${baseUrl}/portal`

    for (const appointment of candidates) {
      const tutor = appointment.patient.tutor
      const tutorEmail = tutor.email?.trim()

      if (!tutorEmail) {
        skippedCount++
        continue
      }

      const html = renderAppointmentReminderEmail({
        tutorName: tutor.fullName,
        patientName: appointment.patient.name,
        dateTime: appointment.dateTime,
        category: appointment.category,
        vetName: appointment.vet?.name ?? null,
        clinicName: appointment.patient.clinic.name,
        clinicAddress: appointment.patient.clinic.address,
        clinicPhone: appointment.patient.clinic.phone,
        portalUrl,
      })

      try {
        const sent = await this.mailProvider.sendMail({
          to: tutorEmail,
          subject: `[IOUGURT] Lembrete de consulta — ${appointment.patient.name}`,
          html,
        })

        if (sent === false) {
          failedCount++
          continue
        }

        await this.appointmentsRepository.markReminderSent(appointment.id, now)
        sentCount++
      } catch {
        failedCount++
      }
    }

    return {
      totalFound: candidates.length,
      sentCount,
      failedCount,
      skippedCount,
    }
  }
}

