import type { FastifyReply, FastifyRequest } from 'fastify'
import { makeListClinicBudgetsUseCase } from '../../../useCases/factories/makeListClinicBudgetsUseCase'
import type { ClinicBudgetsParams, ListBudgetsQuery } from '../budgetSchemas'

export async function listBudgetsController(
  request: FastifyRequest<{ Params: ClinicBudgetsParams; Querystring: ListBudgetsQuery }>,
  reply: FastifyReply,
) {
  const { clinicId } = request.user
  const useCase = makeListClinicBudgetsUseCase()
  const result = await useCase.execute({ ...request.query, clinicId })
  return reply.status(200).send(result)
}
