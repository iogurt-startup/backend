import { PrismaPatientsRepository } from '../../../patient/infra/repositories/PrismaPatientsRepository'
import { PrismaPatientPhotosRepository } from '../../infra/repositories/PrismaPatientPhotosRepository'
import { UploadPatientPhotoUseCase } from '../photos/uploadPatientPhotoUseCase'
import { ListPatientPhotosUseCase } from '../photos/listPatientPhotosUseCase'

export function makeUploadPatientPhotoUseCase() {
  const patientPhotosRepository = new PrismaPatientPhotosRepository()
  const patientsRepository = new PrismaPatientsRepository()
  return new UploadPatientPhotoUseCase(patientPhotosRepository, patientsRepository)
}

export function makeListPatientPhotosUseCase() {
  const patientPhotosRepository = new PrismaPatientPhotosRepository()
  const patientsRepository = new PrismaPatientsRepository()
  return new ListPatientPhotosUseCase(patientPhotosRepository, patientsRepository)
}
