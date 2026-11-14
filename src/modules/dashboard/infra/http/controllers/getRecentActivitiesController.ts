import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeGetRecentActivitiesUseCase } from '../../../useCases/factories/makeDashboardUseCases'

export const getRecentActivitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export async function getRecentActivitiesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { clinicId } = request.user
  const { limit } = getRecentActivitiesQuerySchema.parse(request.query)
  const useCase = makeGetRecentActivitiesUseCase()

  const activities = await useCase.execute({ clinicId, limit })

  return reply.status(200).send(activities)
}
