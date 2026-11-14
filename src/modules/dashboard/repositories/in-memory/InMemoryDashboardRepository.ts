import type {
  IDashboardRepository,
  DailyOverview,
  AdminMetrics,
  AppointmentTrendPoint,
  RecentActivities,
} from '../IDashboardRepository'

export class InMemoryDashboardRepository implements IDashboardRepository {
  async getDailyOverview(date: Date, vetId?: string, clinicId?: string): Promise<DailyOverview> {
    return {
      totalAppointments: 10,
      scheduled: 4,
      inProgress: 2,
      completed: 3,
      cancelled: 1,
    }
  }

  async getAdminMetrics(clinicId: string): Promise<AdminMetrics> {
    return {
      totalPatients: 150,
      appointmentsThisWeek: 45,
      appointmentsThisMonth: 120,
      timeline: {
        past: 94,
        future: 18,
      },
      week: {
        total: 45,
        scheduled: 20,
        inProgress: 4,
        completed: 18,
        cancelled: 3,
      },
      month: {
        total: 120,
        scheduled: 40,
        inProgress: 10,
        completed: 62,
        cancelled: 8,
      },
      categories: {
        week: {
          observation: 19,
          vaccination: 11,
          exam: 8,
          surgical: 7,
        },
        month: {
          observation: 50,
          vaccination: 28,
          exam: 21,
          surgical: 21,
        },
      },
    }
  }

  async getAppointmentsTrend(clinicId: string, days: number): Promise<AppointmentTrendPoint[]> {
    const trend: AppointmentTrendPoint[] = []

    for (let index = days - 1; index >= 0; index--) {
      const date = new Date()
      date.setDate(date.getDate() - index)

      trend.push({
        date: date.toISOString().slice(0, 10),
        totalAppointments: (index % 6) + 1,
      })
    }

    return trend
  }

  async getRecentActivities(clinicId: string, limit: number): Promise<RecentActivities> {
    const now = new Date()

    return {
      recentAppointments: [{
        id: 'appointment-1',
        patientId: 'patient-1',
        patientName: 'Rex',
        activityType: 'APPOINTMENT_UPDATED' as const,
        updatedAt: now,
      }].slice(0, limit),
      recentPatients: [{
        id: 'patient-1',
        name: 'Rex',
        tutorName: 'Maria Silva',
        activityType: 'PATIENT_CREATED' as const,
        createdAt: now,
      }].slice(0, limit),
    }
  }
}
