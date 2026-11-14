import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeListPatientChronicConditionsUseCase } from '../../../useCases/factories/makeChronicConditionUseCases'
import { toChronicConditionResponse } from '../chronicConditionPresenter'

export const listPatientChronicConditionsParamsSchema = z.object({
  patientId: z.string().uuid(),
})

export async function listPatientChronicConditionsController(
  request: FastifyRequest<{ Params: z.infer<typeof listPatientChronicConditionsParamsSchema> }>,
  reply: FastifyReply
) {
  const { patientId } = request.params
  const { clinicId } = request.user

  const useCase = makeListPatientChronicConditionsUseCase()
  const conditions = await useCase.execute({ patientId, clinicId })

  return reply.status(200).send({ items: conditions.map(toChronicConditionResponse) })
}
