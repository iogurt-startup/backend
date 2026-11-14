export interface DailyOverview {
  totalAppointments: number
  scheduled: number
  inProgress: number
  completed: number
  cancelled: number
}

export interface AdminMetrics {
  totalPatients: number
  appointmentsThisWeek: number
  appointmentsThisMonth: number
  timeline: {
    past: number
    future: number
  }
  week: {
    total: number
    scheduled: number
    inProgress: number
    completed: number
    cancelled: number
  }
  month: {
    total: number
    scheduled: number
    inProgress: number
    completed: number
    cancelled: number
  }
  categories: {
    week: {
      observation: number
      vaccination: number
      exam: number
      surgical: number
    }
    month: {
      observation: number
      vaccination: number
      exam: number
      surgical: number
    }
  }
}

export interface AppointmentTrendPoint {
  date: string
  totalAppointments: number
}

export interface RecentAppointmentActivity {
  id: string
  patientId: string
  patientName: string
  activityType: 'APPOINTMENT_UPDATED'
  updatedAt: Date
}

export interface RecentPatientActivity {
  id: string
  name: string
  tutorName: string
  activityType: 'PATIENT_CREATED'
  createdAt: Date
}

export interface RecentActivities {
  recentAppointments: RecentAppointmentActivity[]
  recentPatients: RecentPatientActivity[]
}

export interface IDashboardRepository {
  getDailyOverview(date: Date, vetId?: string, clinicId?: string): Promise<DailyOverview>
  getAdminMetrics(clinicId: string): Promise<AdminMetrics>
  getAppointmentsTrend(clinicId: string, days: number): Promise<AppointmentTrendPoint[]>
  getRecentActivities(clinicId: string, limit: number): Promise<RecentActivities>
}
