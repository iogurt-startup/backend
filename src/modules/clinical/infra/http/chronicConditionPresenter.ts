import { z } from 'zod'
import { CHRONIC_CONDITION_STATUSES } from '../../repositories/IChronicConditionsRepository'
import type { ChronicCondition } from '../../repositories/IChronicConditionsRepository'

export const chronicConditionResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  name: z.string(),
  diagnosedAt: z.string().datetime().nullable(),
  status: z.enum(CHRONIC_CONDITION_STATUSES),
  observations: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const chronicConditionListResponseSchema = z.object({
  items: z.array(chronicConditionResponseSchema),
})

export function toChronicConditionResponse(condition: ChronicCondition) {
  return {
    id: condition.id,
    patientId: condition.patientId,
    name: condition.name,
    diagnosedAt: condition.diagnosedAt ? condition.diagnosedAt.toISOString() : null,
    status: condition.status as (typeof CHRONIC_CONDITION_STATUSES)[number],
    observations: condition.observations,
    createdAt: condition.createdAt.toISOString(),
    updatedAt: condition.updatedAt.toISOString(),
  }
}
