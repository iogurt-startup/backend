import { prisma } from '../../../../config/prisma'
import type {
  IPatientsRepository, CreatePatientDTO, UpdatePatientDTO, ListPatientsDTO, PatientWithTutor,
} from '../../repositories/IPatientsRepository'
import type { Patient } from '@prisma/client'

const withTutor = { tutor: true } as const

export class PrismaPatientsRepository implements IPatientsRepository {
  async create(data: CreatePatientDTO): Promise<Patient> {
    return prisma.patient.create({ data })
  }

  async findById(id: string): Promise<PatientWithTutor | null> {
    return prisma.patient.findUnique({ where: { id }, include: withTutor })
  }

  async update(id: string, data: UpdatePatientDTO): Promise<PatientWithTutor> {
    return prisma.patient.update({ where: { id }, data, include: withTutor })
  }

  async list({ search, tutorId, species, updateDate, page = 1, perPage = 20 }: ListPatientsDTO): Promise<{ patients: PatientWithTutor[]; total: number }> {
    let dateFilter = {}
    if (updateDate && updateDate.length === 10) {
      const parts = updateDate.split('/')
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const y = parseInt(parts[2], 10)
        dateFilter = {
          updatedAt: {
            gte: new Date(y, m, d, 0, 0, 0, 0),
            lte: new Date(y, m, d, 23, 59, 59, 999),
          }
        }
      }
    }

    const where = {
      ...(tutorId && { tutorId }),
      ...(species && { species }),
      ...dateFilter,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { species: { contains: search, mode: 'insensitive' as const } },
          { tutor: { fullName: { contains: search, mode: 'insensitive' as const } } }
        ]
      }),
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, include: withTutor, skip: (page - 1) * perPage, take: perPage, orderBy: { name: 'asc' } }),
      prisma.patient.count({ where }),
    ])

    return { patients, total }
  }
}
