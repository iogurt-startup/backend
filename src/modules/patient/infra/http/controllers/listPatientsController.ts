import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeListPatientsUseCase } from '../../../useCases/factories/makeListPatientsUseCase'

export const listPatientsQuerySchema = z.object({
  search: z.string().trim().min(2).max(100).optional(),
  tutorId: z.string().uuid().optional(),
  species: z.string().optional(),
  updateDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
})

export async function listPatientsController(request: FastifyRequest, reply: FastifyReply) {
  const query = listPatientsQuerySchema.parse(request.query)
  const { clinicId } = request.user
  const useCase = makeListPatientsUseCase()
  const result = await useCase.execute({ ...query, clinicId })
  return reply.status(200).send(result)
}
