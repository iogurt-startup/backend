import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { CHRONIC_CONDITION_STATUSES } from '../../../repositories/IChronicConditionsRepository'
import { makeCreateChronicConditionUseCase } from '../../../useCases/factories/makeChronicConditionUseCases'
import { toChronicConditionResponse } from '../chronicConditionPresenter'

export const createChronicConditionBodySchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  diagnosedAt: z.string().datetime().optional(),
  status: z.enum(CHRONIC_CONDITION_STATUSES).optional(),
  observations: z.string().max(2000).optional(),
})

export async function createChronicConditionController(
  request: FastifyRequest<{ Body: z.infer<typeof createChronicConditionBodySchema> }>,
  reply: FastifyReply
) {
  const { clinicId } = request.user

  const useCase = makeCreateChronicConditionUseCase()
  const condition = await useCase.execute({ ...request.body, clinicId })

  return reply.status(201).send(toChronicConditionResponse(condition))
}
