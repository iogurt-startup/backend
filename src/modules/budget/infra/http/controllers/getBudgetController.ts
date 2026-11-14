import type { FastifyReply, FastifyRequest } from 'fastify'
import { makeGetBudgetDetailsUseCase } from '../../../useCases/factories/makeGetBudgetDetailsUseCase'
import type { BudgetParams } from '../budgetSchemas'

export async function getBudgetController(
  request: FastifyRequest<{ Params: BudgetParams }>,
  reply: FastifyReply,
) {
  const { clinicId } = request.user
  const useCase = makeGetBudgetDetailsUseCase()
  const budget = await useCase.execute({ id: request.params.id, clinicId })
  return reply.status(200).send({ budget })
}
