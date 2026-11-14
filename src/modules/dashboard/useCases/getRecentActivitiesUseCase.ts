import type { IDashboardRepository, RecentActivities } from '../repositories/IDashboardRepository'

interface GetRecentActivitiesRequest {
  clinicId: string
  limit: number
}

export class GetRecentActivitiesUseCase {
  constructor(private dashboardRepository: IDashboardRepository) {}

  async execute({ clinicId, limit }: GetRecentActivitiesRequest): Promise<RecentActivities> {
    return this.dashboardRepository.getRecentActivities(clinicId, limit)
  }
}
