import { prisma } from '../../../../config/prisma'
import type { Prisma } from '@prisma/client'
import type {
  IDashboardRepository,
  DailyOverview,
  AdminMetrics,
  AppointmentTrendPoint,
  RecentActivities,
} from '../../repositories/IDashboardRepository'
import dayjs from 'dayjs'

type PeriodStatusMetrics = AdminMetrics['week']
type CategoryMetrics = AdminMetrics['categories']['week']

const EMPTY_PERIOD_STATUS_METRICS: PeriodStatusMetrics = {
  total: 0,
  scheduled: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
}

const EMPTY_CATEGORY_METRICS: CategoryMetrics = {
  observation: 0,
  vaccination: 0,
  exam: 0,
  surgical: 0,
}

function buildStatusMetrics(
  groupedByStatus: Array<{ status: string, _count: { _all: number } }>
): PeriodStatusMetrics {
  const metrics: PeriodStatusMetrics = { ...EMPTY_PERIOD_STATUS_METRICS }

  for (const item of groupedByStatus) {
    const total = item._count._all

    if (item.status === 'SCHEDULED') metrics.scheduled = total
    else if (item.status === 'IN_PROGRESS') metrics.inProgress = total
    else if (item.status === 'COMPLETED') metrics.completed = total
    else if (item.status === 'CANCELLED') metrics.cancelled = total
  }

  metrics.total = metrics.scheduled + metrics.inProgress + metrics.completed + metrics.cancelled
  return metrics
}

function buildCategoryMetrics(
  groupedByCategory: Array<{ category: string, _count: { _all: number } }>
): CategoryMetrics {
  const metrics: CategoryMetrics = { ...EMPTY_CATEGORY_METRICS }

  for (const item of groupedByCategory) {
    const total = item._count._all

    if (item.category === 'OBSERVATION') metrics.observation = total
    else if (item.category === 'VACCINATION') metrics.vaccination = total
    else if (item.category === 'EXAM') metrics.exam = total
    else if (item.category === 'SURGICAL') metrics.surgical = total
  }

  return metrics
}

export class PrismaDashboardRepository implements IDashboardRepository {
  async getDailyOverview(date: Date, vetId?: string, clinicId?: string): Promise<DailyOverview> {
    const startOfDay = dayjs(date).startOf('day').toDate()
    const endOfDay = dayjs(date).endOf('day').toDate()

    const appointments = await prisma.appointment.findMany({
      where: {
        dateTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        ...(vetId && { vetId }),
        ...(clinicId && { patient: { clinicId } }),
      },
      select: { status: true },
    })

    const overview: DailyOverview = {
      totalAppointments: appointments.length,
      scheduled: 0, inProgress: 0, completed: 0, cancelled: 0,
    }

    for (const appt of appointments) {
      if (appt.status === 'SCHEDULED') overview.scheduled++
      else if (appt.status === 'IN_PROGRESS') overview.inProgress++
      else if (appt.status === 'COMPLETED') overview.completed++
      else if (appt.status === 'CANCELLED') overview.cancelled++
    }

    return overview
  }

  async getAdminMetrics(clinicId: string): Promise<AdminMetrics> {
    const clinicWhere: Prisma.AppointmentWhereInput = {
      patient: { clinicId },
    }
    const now = new Date()

    const weekRange = {
      gte: dayjs().startOf('week').toDate(),
      lte: dayjs().endOf('week').toDate(),
    }

    const monthRange = {
      gte: dayjs().startOf('month').toDate(),
      lte: dayjs().endOf('month').toDate(),
    }

    const weekWhere: Prisma.AppointmentWhereInput = {
      ...clinicWhere,
      dateTime: weekRange,
      status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    }

    const monthWhere: Prisma.AppointmentWhereInput = {
      ...clinicWhere,
      dateTime: monthRange,
      status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    }

    const [
      totalPatients,
      pastAppointments,
      futureAppointments,
      weekStatusRows,
      monthStatusRows,
      weekCategoryRows,
      monthCategoryRows,
    ] = await Promise.all([
      prisma.patient.count({ where: { clinicId } }),
      prisma.appointment.count({
        where: {
          ...clinicWhere,
          dateTime: { lt: now },
          status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
        },
      }),
      prisma.appointment.count({
        where: {
          ...clinicWhere,
          dateTime: { gt: now },
          status: 'SCHEDULED',
        },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: weekWhere,
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: monthWhere,
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ['category'],
        where: weekWhere,
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ['category'],
        where: monthWhere,
        _count: { _all: true },
      }),
    ])

    const week = buildStatusMetrics(weekStatusRows)
    const month = buildStatusMetrics(monthStatusRows)

    return {
      totalPatients,
      appointmentsThisWeek: week.total,
      appointmentsThisMonth: month.total,
      timeline: {
        past: pastAppointments,
        future: futureAppointments,
      },
      week,
      month,
      categories: {
        week: buildCategoryMetrics(weekCategoryRows),
        month: buildCategoryMetrics(monthCategoryRows),
      },
    }
  }

  async getAppointmentsTrend(clinicId: string, days: number): Promise<AppointmentTrendPoint[]> {
    const safeDays = Math.max(1, days)
    const endDate = dayjs().endOf('day')
    const startDate = endDate.subtract(safeDays - 1, 'day').startOf('day')

    const appointments = await prisma.appointment.findMany({
      where: {
        dateTime: { gte: startDate.toDate(), lte: endDate.toDate() },
        patient: { clinicId },
        status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      select: { dateTime: true },
    })

    const totalsByDay = new Map<string, number>()

    for (const appointment of appointments) {
      const key = dayjs(appointment.dateTime).format('YYYY-MM-DD')
      totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + 1)
    }

    const trend: AppointmentTrendPoint[] = []

    for (let index = 0; index < safeDays; index++) {
      const currentDay = startDate.add(index, 'day')
      const key = currentDay.format('YYYY-MM-DD')

      trend.push({
        date: key,
        totalAppointments: totalsByDay.get(key) ?? 0,
      })
    }

    return trend
  }

  async getRecentActivities(clinicId: string, limit: number): Promise<RecentActivities> {
    const [appointments, patients] = await Promise.all([
      prisma.appointment.findMany({
        where: { patient: { clinicId } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          patientId: true,
          updatedAt: true,
          patient: { select: { name: true } },
        },
      }),
      prisma.patient.findMany({
        where: { clinicId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          createdAt: true,
          tutor: { select: { fullName: true } },
        },
      }),
    ])

    return {
      recentAppointments: appointments.map(appointment => ({
        id: appointment.id,
        patientId: appointment.patientId,
        patientName: appointment.patient.name,
        activityType: 'APPOINTMENT_UPDATED',
        updatedAt: appointment.updatedAt,
      })),
      recentPatients: patients.map(patient => ({
        id: patient.id,
        name: patient.name,
        tutorName: patient.tutor.fullName,
        activityType: 'PATIENT_CREATED',
        createdAt: patient.createdAt,
      })),
    }
  }
}
