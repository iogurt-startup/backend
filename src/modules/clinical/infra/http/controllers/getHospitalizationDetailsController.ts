import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeGetHospitalizationDetailsUseCase } from '../../../useCases/factories/makeHospitalizationUseCases'
import { toHospitalizationDetailsResponse } from '../hospitalizationPresenter'

export const getHospitalizationDetailsParamsSchema = z.object({
  clinicId: z.string().uuid(),
  id: z.string().uuid(),
})

export async function getHospitalizationDetailsController(
  request: FastifyRequest<{ Params: z.infer<typeof getHospitalizationDetailsParamsSchema> }>,
  reply: FastifyReply
) {
  const { clinicId } = request.user
  const { id } = request.params

  const useCase = makeGetHospitalizationDetailsUseCase()
  const hospitalization = await useCase.execute({ hospitalizationId: id, clinicId })

  return reply.status(200).send(toHospitalizationDetailsResponse(hospitalization))
}
