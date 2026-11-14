import type { ChronicCondition } from '@prisma/client'

export type { ChronicCondition }

export const CHRONIC_CONDITION_STATUSES = ['ACTIVE', 'INACTIVE', 'RESOLVED'] as const
export type ChronicConditionStatus = (typeof CHRONIC_CONDITION_STATUSES)[number]

export interface CreateChronicConditionDTO {
  patientId: string
  name: string
  diagnosedAt?: Date | null
  status: ChronicConditionStatus
  observations?: string | null
}

export interface UpdateChronicConditionDTO {
  name?: string
  diagnosedAt?: Date | null
  status?: ChronicConditionStatus
  observations?: string | null
}

export interface IChronicConditionsRepository {
  create(data: CreateChronicConditionDTO): Promise<ChronicCondition>
  listByPatient(patientId: string): Promise<ChronicCondition[]>
  // Escopado por clínica e por paciente ativo (deletedAt = null).
  findById(id: string, clinicId: string): Promise<ChronicCondition | null>
  update(id: string, data: UpdateChronicConditionDTO): Promise<ChronicCondition>
}
