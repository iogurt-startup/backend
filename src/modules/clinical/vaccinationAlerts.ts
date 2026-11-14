import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

export type VaccinationAlertStatus = 'OVERDUE' | 'UPCOMING'

export interface VaccinationAlertPatient {
  id: string
  name: string
  species: string
}

export interface VaccinationAlertTutor {
  id: string
  fullName: string
  phone: string
}

export interface VaccinationAlertItem {
  id: string
  vaccineName: string
  doseNumber: number | null
  nextDoseAt: Date
  status: VaccinationAlertStatus
  daysDifference: number
  daysOverdue?: number
  daysUntilDue?: number
  patient: VaccinationAlertPatient
  tutor: VaccinationAlertTutor
}

export interface VaccinationRecordWithRelations {
  id: string
  patientId: string
  vaccineName: string
  appliedAt: Date | null
  nextDoseAt: Date | null
  doseNumber: number | null
  intervalDays: number | null
  status: string
  createdAt: Date
  patient: {
    id: string
    name: string
    species: string
    clinicId: string
    deletedAt?: Date | null
    tutor: {
      id: string
      fullName: string
      phone: string
    }
  }
}

/**
 * Filtra e classifica alertas de vacinação a partir de uma lista de registros
 * aplicando as regras de negócio para OVERDUE e UPCOMING.
 */
export function classifyVaccinationAlerts(
  records: VaccinationRecordWithRelations[],
  options?: {
    status?: VaccinationAlertStatus
    days?: number
    referenceDate?: Date
  }
): VaccinationAlertItem[] {
  const referenceDate = options?.referenceDate ?? new Date()
  const thresholdDays = options?.days ?? 15
  const refStartOfDay = dayjs(referenceDate).startOf('day')
  const thresholdEndOfDay = refStartOfDay.add(thresholdDays, 'day').endOf('day')

  // Agrupa vacinações por paciente e nome da vacina para identificar se uma dose subsequente já foi aplicada
  const appliedRecordsByKey = new Map<string, VaccinationRecordWithRelations[]>()

  for (const record of records) {
    if (record.appliedAt) {
      const key = `${record.patientId}::${record.vaccineName.trim().toLowerCase()}`
      const existing = appliedRecordsByKey.get(key) || []
      existing.push(record)
      appliedRecordsByKey.set(key, existing)
    }
  }

  const alerts: VaccinationAlertItem[] = []

  for (const record of records) {
    // Se não tem nextDoseAt e não está OVERDUE, não há pendência
    if (!record.nextDoseAt && record.status !== 'OVERDUE') {
      continue
    }

    const targetDate = record.nextDoseAt ?? record.appliedAt ?? record.createdAt
    const key = `${record.patientId}::${record.vaccineName.trim().toLowerCase()}`
    const appliedList = appliedRecordsByKey.get(key) || []

    // Verifica se a próxima dose já foi aplicada:
    // Se o registro atual foi aplicado com doseNumber, checa se existe uma dose com número maior ou aplicada após targetDate
    const nextDoseAlreadyApplied = appliedList.some((other) => {
      if (other.id === record.id) return false

      if (record.doseNumber != null && other.doseNumber != null) {
        return other.doseNumber > record.doseNumber
      }

      if (record.appliedAt && other.appliedAt) {
        return dayjs(other.appliedAt).isAfter(dayjs(record.appliedAt))
      }

      return false
    })

    if (nextDoseAlreadyApplied) {
      continue
    }

    const targetDay = dayjs(targetDate).startOf('day')
    const isOverdue = record.status === 'OVERDUE' || targetDay.isBefore(refStartOfDay)
    const isUpcoming = !isOverdue && targetDay.isSameOrAfter(refStartOfDay) && targetDay.isSameOrBefore(thresholdEndOfDay)

    if (isOverdue) {
      if (options?.status && options.status !== 'OVERDUE') {
        continue
      }
      const daysOverdue = Math.max(0, refStartOfDay.diff(targetDay, 'day'))
      alerts.push({
        id: record.id,
        vaccineName: record.vaccineName,
        doseNumber: record.doseNumber ?? null,
        nextDoseAt: targetDate,
        status: 'OVERDUE',
        daysDifference: daysOverdue,
        daysOverdue,
        patient: {
          id: record.patient.id,
          name: record.patient.name,
          species: record.patient.species,
        },
        tutor: {
          id: record.patient.tutor.id,
          fullName: record.patient.tutor.fullName,
          phone: record.patient.tutor.phone,
        },
      })
    } else if (isUpcoming) {
      if (options?.status && options.status !== 'UPCOMING') {
        continue
      }
      const daysUntilDue = Math.max(0, targetDay.diff(refStartOfDay, 'day'))
      alerts.push({
        id: record.id,
        vaccineName: record.vaccineName,
        doseNumber: record.doseNumber ?? null,
        nextDoseAt: targetDate,
        status: 'UPCOMING',
        daysDifference: daysUntilDue,
        daysUntilDue,
        patient: {
          id: record.patient.id,
          name: record.patient.name,
          species: record.patient.species,
        },
        tutor: {
          id: record.patient.tutor.id,
          fullName: record.patient.tutor.fullName,
          phone: record.patient.tutor.phone,
        },
      })
    }
  }

  // Ordena alertas:
  // OVERDUE: do mais atrasado para o menos atrasado
  // UPCOMING: da data mais próxima para a mais distante
  alerts.sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1
    if (a.status !== 'OVERDUE' && b.status === 'OVERDUE') return 1
    return new Date(a.nextDoseAt).getTime() - new Date(b.nextDoseAt).getTime()
  })

  return alerts
}
