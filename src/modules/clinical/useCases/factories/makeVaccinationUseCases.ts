import { PrismaPatientsRepository } from '../../../patient/infra/repositories/PrismaPatientsRepository'
import { PrismaVaccinationsRepository } from '../../infra/repositories/PrismaVaccinationsRepository'
import { AddVaccinationUseCase } from '../vaccinations/addVaccinationUseCase'
import { ListPatientVaccinationsUseCase } from '../vaccinations/listPatientVaccinationsUseCase'
import { UpdateVaccinationStatusUseCase } from '../vaccinations/updateVaccinationStatusUseCase'
import { GetClinicVaccinationAlertsUseCase } from '../vaccinations/getClinicVaccinationAlertsUseCase'

export function makeAddVaccinationUseCase() {
  const vaccinationsRepository = new PrismaVaccinationsRepository()
  const patientsRepository = new PrismaPatientsRepository()
  return new AddVaccinationUseCase(vaccinationsRepository, patientsRepository)
}

export function makeListPatientVaccinationsUseCase() {
  const vaccinationsRepository = new PrismaVaccinationsRepository()
  return new ListPatientVaccinationsUseCase(vaccinationsRepository)
}

export function makeUpdateVaccinationStatusUseCase() {
  const vaccinationsRepository = new PrismaVaccinationsRepository()
  return new UpdateVaccinationStatusUseCase(vaccinationsRepository)
}

export function makeGetClinicVaccinationAlertsUseCase() {
  const vaccinationsRepository = new PrismaVaccinationsRepository()
  return new GetClinicVaccinationAlertsUseCase(vaccinationsRepository)
}
