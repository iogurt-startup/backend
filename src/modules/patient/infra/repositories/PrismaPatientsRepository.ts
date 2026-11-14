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

  async findById(id: string, clinicId: string): Promise<PatientWithTutor | null> {
    return prisma.patient.findFirst({ where: { id, clinicId, deletedAt: null }, include: withTutor })
  }

  async update(id: string, data: UpdatePatientDTO): Promise<Patient> {
    return prisma.patient.update({ where: { id }, data })
  }

  async softDelete(id: string): Promise<void> {
    await prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async list({ clinicId, search, tutorId, species, updateDate, page = 1, perPage = 20 }: ListPatientsDTO): Promise<{ patients: PatientWithTutor[]; total: number }> {
    const normalizedSearch = search?.trim()
    const cpfSearch = normalizedSearch?.replace(/\D/g, '')
    const isCpfSearch = Boolean(
      normalizedSearch && /^[\d.\-\s]+$/.test(normalizedSearch) && cpfSearch,
    )

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
      clinicId,
      deletedAt: null,
      ...(tutorId && { tutorId }),
      ...(species && { species }),
      ...dateFilter,
      ...(normalizedSearch && {
        OR: [
          { name: { contains: normalizedSearch, mode: 'insensitive' as const } },
          { species: { contains: normalizedSearch, mode: 'insensitive' as const } },
          { tutor: { fullName: { contains: normalizedSearch, mode: 'insensitive' as const } } },
          ...(isCpfSearch ? [{ tutor: { cpf: { contains: cpfSearch } } }] : []),
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
