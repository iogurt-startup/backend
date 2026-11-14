import { PrismaDashboardRepository } from '../../infra/repositories/PrismaDashboardRepository'
import { PrismaUsersRepository } from '../../../auth/infra/repositories/PrismaUsersRepository'
import { GetDailyOverviewUseCase } from '../getDailyOverviewUseCase'
import { GetAdminMetricsUseCase } from '../getAdminMetricsUseCase'
import { GetAdminAppointmentsTrendUseCase } from '../getAdminAppointmentsTrendUseCase'
import { GetRecentActivitiesUseCase } from '../getRecentActivitiesUseCase'

export function makeGetDailyOverviewUseCase() {
  const dashboardRepository = new PrismaDashboardRepository()
  const usersRepository = new PrismaUsersRepository()
  return new GetDailyOverviewUseCase(dashboardRepository, usersRepository)
}

export function makeGetAdminMetricsUseCase() {
  const dashboardRepository = new PrismaDashboardRepository()
  const usersRepository = new PrismaUsersRepository()
  return new GetAdminMetricsUseCase(dashboardRepository, usersRepository)
}

export function makeGetAdminAppointmentsTrendUseCase() {
  const dashboardRepository = new PrismaDashboardRepository()
  const usersRepository = new PrismaUsersRepository()
  return new GetAdminAppointmentsTrendUseCase(dashboardRepository, usersRepository)
}

export function makeGetRecentActivitiesUseCase() {
  const dashboardRepository = new PrismaDashboardRepository()
  return new GetRecentActivitiesUseCase(dashboardRepository)
}
