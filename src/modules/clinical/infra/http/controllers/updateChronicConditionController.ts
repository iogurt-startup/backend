import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { CHRONIC_CONDITION_STATUSES } from '../../../repositories/IChronicConditionsRepository'
import { makeUpdateChronicConditionUseCase } from '../../../useCases/factories/makeChronicConditionUseCases'
import { toChronicConditionResponse } from '../chronicConditionPresenter'

export const updateChronicConditionParamsSchema = z.object({
  id: z.string().uuid(),
})

// .strict() impede a troca de paciente (patientId) e rejeita campos desconhecidos.
export const updateChronicConditionBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    diagnosedAt: z.string().datetime().nullable().optional(),
    status: z.enum(CHRONIC_CONDITION_STATUSES).optional(),
    observations: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine(body => Object.values(body).some(value => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar.',
  })

export async function updateChronicConditionController(
  request: FastifyRequest<{
    Params: z.infer<typeof updateChronicConditionParamsSchema>
    Body: z.infer<typeof updateChronicConditionBodySchema>
  }>,
  reply: FastifyReply
) {
  const { id } = request.params
  const { clinicId } = request.user

  const useCase = makeUpdateChronicConditionUseCase()
  const condition = await useCase.execute({ id, clinicId, ...request.body })

  return reply.status(200).send(toChronicConditionResponse(condition))
}
