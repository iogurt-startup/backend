import { prisma } from '../../../../config/prisma'
import type {
  ChronicCondition,
  CreateChronicConditionDTO,
  IChronicConditionsRepository,
  UpdateChronicConditionDTO,
} from '../../repositories/IChronicConditionsRepository'

export class PrismaChronicConditionsRepository implements IChronicConditionsRepository {
  async create(data: CreateChronicConditionDTO): Promise<ChronicCondition> {
    return prisma.chronicCondition.create({ data })
  }

  async listByPatient(patientId: string): Promise<ChronicCondition[]> {
    return prisma.chronicCondition.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, clinicId: string): Promise<ChronicCondition | null> {
    return prisma.chronicCondition.findFirst({
      where: { id, patient: { clinicId, deletedAt: null } },
    })
  }

  async update(id: string, data: UpdateChronicConditionDTO): Promise<ChronicCondition> {
    return prisma.chronicCondition.update({ where: { id }, data })
  }
}
