import { AppError } from '../../../shared/errors/app-error'
import { prisma } from '../../../config/prisma'
import { clinicalObservationsToPlainText } from '../../../shared/clinical/routine-guidance-meta'
import { classifyVaccinationAlerts } from '../../clinical/vaccinationAlerts'

interface GetTutorAlertsRequest {
  userId: string
  referenceDate?: Date
}

export interface TutorAlertItem {
  type: 'overdue_vaccine' | 'upcoming_vaccine' | 'vet_recommendation'
  message: string
  patientName: string
  patientId?: string
  vaccineName?: string
  doseNumber?: number
  date?: Date
  daysDifference?: number
}

export class GetTutorAlertsUseCase {
  async execute({ userId, referenceDate }: GetTutorAlertsRequest) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tutorAccount: { include: { patients: true } } },
    })

    if (!user || user.role !== 'TUTOR') {
      throw new AppError('Acesso restrito ao portal do tutor.', 403)
    }

    const tutor = user.tutorAccount

    if (!tutor) {
      throw new AppError('Conta de tutor não encontrada.', 404)
    }

    const patientIds = tutor.patients.map((p) => p.id)
    const alerts: TutorAlertItem[] = []

    // 1. Alertas de Vacinação (OVERDUE e UPCOMING nos próximos 30 dias)
    const allVaccinations = await prisma.vaccination.findMany({
      where: {
        patientId: { in: patientIds },
        patient: { deletedAt: null },
      },
      include: {
        patient: {
          include: {
            tutor: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const vaccineAlerts = classifyVaccinationAlerts(allVaccinations as any, {
      days: 30,
      referenceDate,
    })

    for (const v of vaccineAlerts) {
      if (v.status === 'OVERDUE') {
        alerts.push({
          type: 'overdue_vaccine',
          message: `Vacina "${v.vaccineName}" está atrasada!`,
          patientName: v.patient.name,
          patientId: v.patient.id,
          vaccineName: v.vaccineName,
          doseNumber: v.doseNumber ?? undefined,
          date: v.nextDoseAt,
          daysDifference: v.daysDifference,
        })
      } else {
        alerts.push({
          type: 'upcoming_vaccine',
          message: `Vacina "${v.vaccineName}" vence em breve.`,
          patientName: v.patient.name,
          patientId: v.patient.id,
          vaccineName: v.vaccineName,
          doseNumber: v.doseNumber ?? undefined,
          date: v.nextDoseAt,
          daysDifference: v.daysDifference,
        })
      }
    }

    // 2. Recomendações do último prontuário finalizado de cada pet
    for (const patientId of patientIds) {
      const lastRecord = await prisma.clinicalRecord.findFirst({
        where: { patientId, finalized: true },
        orderBy: { createdAt: 'desc' },
        include: { patient: { select: { name: true } } },
      })

      const recommendation = lastRecord ? clinicalObservationsToPlainText(lastRecord) : ''

      if (lastRecord && recommendation) {
        alerts.push({
          type: 'vet_recommendation',
          message: recommendation,
          patientName: lastRecord.patient.name,
          patientId,
        })
      }
    }

    return { alerts }
  }
}
