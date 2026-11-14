import { prisma } from '../../../../config/prisma'
import type {
  IPatientPhotosRepository,
  CreatePatientPhotoDTO,
  PatientPhoto,
} from '../../repositories/IPatientPhotosRepository'

export class PrismaPatientPhotosRepository implements IPatientPhotosRepository {
  async create(data: CreatePatientPhotoDTO): Promise<PatientPhoto> {
    return prisma.patientPhoto.create({ data })
  }

  async listByPatient(patientId: string): Promise<PatientPhoto[]> {
    // Ordem cronológica crescente: a galeria é uma linha do tempo da evolução
    // do paciente, então a foto mais antiga vem primeiro.
    return prisma.patientPhoto.findMany({
      where: { patientId },
      orderBy: { takenAt: 'asc' },
    })
  }

  async findById(id: string): Promise<PatientPhoto | null> {
    return prisma.patientPhoto.findUnique({ where: { id } })
  }

  async delete(id: string): Promise<void> {
    await prisma.patientPhoto.delete({ where: { id } })
  }
}
