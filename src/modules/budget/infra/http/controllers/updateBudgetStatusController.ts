import type { FastifyReply, FastifyRequest } from 'fastify'
import { makeUpdateBudgetStatusUseCase } from '../../../useCases/factories/makeUpdateBudgetStatusUseCase'
import type { BudgetParams, UpdateBudgetStatusBody } from '../budgetSchemas'

export async function updateBudgetStatusController(
  request: FastifyRequest<{ Params: BudgetParams; Body: UpdateBudgetStatusBody }>,
  reply: FastifyReply,
) {
  const { clinicId } = request.user
  const useCase = makeUpdateBudgetStatusUseCase()
  const budget = await useCase.execute({
    id: request.params.id,
    clinicId,
    status: request.body.status,
  })
  return reply.status(200).send({ budget })
}
