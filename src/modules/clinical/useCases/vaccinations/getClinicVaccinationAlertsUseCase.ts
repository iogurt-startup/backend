import type { IVaccinationsRepository } from '../../repositories/IVaccinationsRepository'
import type { VaccinationAlertItem, VaccinationAlertStatus } from '../../vaccinationAlerts'

export interface GetClinicVaccinationAlertsRequest {
  clinicId: string
  status?: VaccinationAlertStatus
  days?: number
  referenceDate?: Date
}

export interface GetClinicVaccinationAlertsResponse {
  items: VaccinationAlertItem[]
  total: number
}

export class GetClinicVaccinationAlertsUseCase {
  constructor(private vaccinationsRepository: IVaccinationsRepository) {}

  async execute({
    clinicId,
    status,
    days = 15,
    referenceDate,
  }: GetClinicVaccinationAlertsRequest): Promise<GetClinicVaccinationAlertsResponse> {
    const items = await this.vaccinationsRepository.findAlertsByClinic(clinicId, {
      status,
      days,
      referenceDate,
    })

    return {
      items,
      total: items.length,
    }
  }
}
