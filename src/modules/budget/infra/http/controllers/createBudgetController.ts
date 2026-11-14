import type { FastifyReply, FastifyRequest } from 'fastify'
import { makeCreateBudgetUseCase } from '../../../useCases/factories/makeCreateBudgetUseCase'
import type { ClinicBudgetsParams, CreateBudgetBody } from '../budgetSchemas'

export async function createBudgetController(
  request: FastifyRequest<{ Params: ClinicBudgetsParams; Body: CreateBudgetBody }>,
  reply: FastifyReply,
) {
  const { clinicId } = request.user
  const useCase = makeCreateBudgetUseCase()
  const budget = await useCase.execute({ ...request.body, clinicId })
  return reply.status(201).send({ budget })
}
