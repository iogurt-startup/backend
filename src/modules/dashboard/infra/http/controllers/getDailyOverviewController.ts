import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeGetDailyOverviewUseCase } from '../../../useCases/factories/makeDashboardUseCases'

export const getDailyOverviewQuerySchema = z.object({
  date: z.string().datetime().optional(), // ISO string, defaults to today
  vetId: z.string().uuid().optional(),    // Optional, defaults to logged user
})

export async function getDailyOverviewController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { date, vetId } = getDailyOverviewQuerySchema.parse(request.query)
  const { userId, clinicId } = request.user

  const targetDate = date ? new Date(date) : new Date()
  const targetVetId = vetId ?? userId

  const useCase = makeGetDailyOverviewUseCase()

  const overview = await useCase.execute({
    date: targetDate,
    vetId: targetVetId,
    userId,
    clinicId,
  })

  return reply.status(200).send(overview)
}
