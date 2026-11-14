import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/prisma'
import type {
  CreateHospitalizationDTO,
  CreateHospitalizationEvolutionDTO,
  DischargeHospitalizationDTO,
  Hospitalization,
  HospitalizationDetails,
  HospitalizationEvolution,
  HospitalizationWithPatient,
  IHospitalizationsRepository,
  OpenHospitalizationStatus,
} from '../../repositories/IHospitalizationsRepository'
import {
  OPEN_HOSPITALIZATION_STATUSES,
  OpenHospitalizationConflictError,
} from '../../repositories/IHospitalizationsRepository'

const PATIENT_CARD_SELECT = {
  id: true,
  name: true,
  species: true,
  photoUrl: true,
} as const

const VET_SELECT = { id: true, name: true } as const

export class PrismaHospitalizationsRepository implements IHospitalizationsRepository {
  async create(data: CreateHospitalizationDTO): Promise<Hospitalization> {
    try {
      return await prisma.hospitalization.create({ data })
    } catch (error) {
      // P2002 = violação de unicidade. O índice parcial criado na migration
      // só permite uma internação em aberto por paciente, então esta é a
      // corrida que a checagem do caso de uso não consegue cobrir.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new OpenHospitalizationConflictError()
      }
      throw error
    }
  }

  async findOpenByPatient(patientId: string): Promise<Hospitalization | null> {
    return prisma.hospitalization.findFirst({
      where: { patientId, status: { in: [...OPEN_HOSPITALIZATION_STATUSES] } },
    })
  }

  async findById(id: string, clinicId: string): Promise<Hospitalization | null> {
    return prisma.hospitalization.findFirst({ where: { id, clinicId } })
  }

  async findDetailsById(id: string, clinicId: string): Promise<HospitalizationDetails | null> {
    return prisma.hospitalization.findFirst({
      where: { id, clinicId },
      include: {
        patient: { select: PATIENT_CARD_SELECT },
        admittedByVet: { select: VET_SELECT },
        evolutions: {
          orderBy: { recordedAt: 'asc' },
          include: { recordedByVet: { select: VET_SELECT } },
        },
      },
    })
  }

  async listActiveByClinic(clinicId: string): Promise<HospitalizationWithPatient[]> {
    return prisma.hospitalization.findMany({
      where: { clinicId, status: { in: [...OPEN_HOSPITALIZATION_STATUSES] } },
      include: {
        patient: { select: PATIENT_CARD_SELECT },
        admittedByVet: { select: VET_SELECT },
      },
      // Só a ordem cronológica vem do banco. A prioridade por criticidade
      // fica no caso de uso: ordenar por `status` aqui dependeria da ordem de
      // declaração do enum no schema, que alguém pode reordenar sem perceber,
      // e faria o Prisma divergir do repositório em memória que os testes usam.
      orderBy: { admittedAt: 'asc' },
    })
  }

  async discharge(
    id: string,
    data: DischargeHospitalizationDTO
  ): Promise<Hospitalization | null> {
    // `updateMany` com o status na cláusula where: o banco decide se a
    // internação ainda estava aberta. Com `update` simples, duas altas
    // simultâneas passariam as duas e a segunda sobrescreveria a data da
    // primeira.
    const { count } = await prisma.hospitalization.updateMany({
      where: { id, status: { in: [...OPEN_HOSPITALIZATION_STATUSES] } },
      data: {
        status: 'DISCHARGED',
        dischargedAt: data.dischargedAt,
        dischargeNotes: data.dischargeNotes ?? null,
      },
    })

    if (count === 0) return null

    return prisma.hospitalization.findUniqueOrThrow({ where: { id } })
  }

  async updateStatus(
    id: string,
    status: OpenHospitalizationStatus
  ): Promise<Hospitalization | null> {
    const { count } = await prisma.hospitalization.updateMany({
      where: { id, status: { in: [...OPEN_HOSPITALIZATION_STATUSES] } },
      data: { status },
    })

    if (count === 0) return null

    return prisma.hospitalization.findUniqueOrThrow({ where: { id } })
  }

  async addEvolution(
    data: CreateHospitalizationEvolutionDTO
  ): Promise<HospitalizationEvolution | null> {
    // A internação precisa estar aberta no instante da escrita, senão uma
    // aferição entraria depois da alta.
    const open = await prisma.hospitalization.findFirst({
      where: { id: data.hospitalizationId, status: { in: [...OPEN_HOSPITALIZATION_STATUSES] } },
      select: { id: true },
    })

    if (!open) return null

    return prisma.hospitalizationEvolution.create({ data })
  }
}
