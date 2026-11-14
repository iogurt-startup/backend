import { prisma } from '../../../../config/prisma'
import type {
  IVaccinationsRepository,
  CreateVaccinationDTO,
  Vaccination,
  VaccinationStatus,
  ListVaccinationAlertsFilters,
} from '../../repositories/IVaccinationsRepository'
import { classifyVaccinationAlerts, type VaccinationAlertItem } from '../../vaccinationAlerts'

export class PrismaVaccinationsRepository implements IVaccinationsRepository {
  async create(data: CreateVaccinationDTO): Promise<Vaccination> {
    return prisma.vaccination.create({ data })
  }

  async listByPatient(patientId: string): Promise<Vaccination[]> {
    return prisma.vaccination.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, clinicId: string): Promise<Vaccination | null> {
    return prisma.vaccination.findFirst({ where: { id, patient: { clinicId } } })
  }

  async updateStatus(id: string, status: VaccinationStatus): Promise<Vaccination> {
    return prisma.vaccination.update({ where: { id }, data: { status } })
  }

  async findAlertsByClinic(
    clinicId: string,
    filters?: ListVaccinationAlertsFilters
  ): Promise<VaccinationAlertItem[]> {
    const rawRecords = await prisma.vaccination.findMany({
      where: {
        patient: {
          clinicId,
          deletedAt: null,
        },
      },
      include: {
        patient: {
          include: {
            tutor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return classifyVaccinationAlerts(rawRecords, filters)
  }
}
