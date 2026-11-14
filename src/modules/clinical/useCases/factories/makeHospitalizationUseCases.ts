import { PrismaPatientsRepository } from '../../../patient/infra/repositories/PrismaPatientsRepository'
import { PrismaHospitalizationsRepository } from '../../infra/repositories/PrismaHospitalizationsRepository'
import { AddHospitalizationEvolutionUseCase } from '../hospitalizations/addHospitalizationEvolutionUseCase'
import { AdmitPatientUseCase } from '../hospitalizations/admitPatientUseCase'
import { DischargePatientUseCase } from '../hospitalizations/dischargePatientUseCase'
import { GetHospitalizationDetailsUseCase } from '../hospitalizations/getHospitalizationDetailsUseCase'
import { ListActiveHospitalizationsUseCase } from '../hospitalizations/listActiveHospitalizationsUseCase'
import { UpdateHospitalizationStatusUseCase } from '../hospitalizations/updateHospitalizationStatusUseCase'

export function makeAdmitPatientUseCase() {
  return new AdmitPatientUseCase(
    new PrismaHospitalizationsRepository(),
    new PrismaPatientsRepository()
  )
}

export function makeListActiveHospitalizationsUseCase() {
  return new ListActiveHospitalizationsUseCase(new PrismaHospitalizationsRepository())
}

export function makeGetHospitalizationDetailsUseCase() {
  return new GetHospitalizationDetailsUseCase(new PrismaHospitalizationsRepository())
}

export function makeAddHospitalizationEvolutionUseCase() {
  return new AddHospitalizationEvolutionUseCase(new PrismaHospitalizationsRepository())
}

export function makeDischargePatientUseCase() {
  return new DischargePatientUseCase(new PrismaHospitalizationsRepository())
}

export function makeUpdateHospitalizationStatusUseCase() {
  return new UpdateHospitalizationStatusUseCase(new PrismaHospitalizationsRepository())
}
