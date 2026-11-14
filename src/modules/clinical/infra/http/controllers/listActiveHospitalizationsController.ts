import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeListActiveHospitalizationsUseCase } from '../../../useCases/factories/makeHospitalizationUseCases'
import { toHospitalizationCardResponse } from '../hospitalizationPresenter'

export const listActiveHospitalizationsParamsSchema = z.object({
  clinicId: z.string().uuid(),
})

export async function listActiveHospitalizationsController(
  request: FastifyRequest<{ Params: z.infer<typeof listActiveHospitalizationsParamsSchema> }>,
  reply: FastifyReply
) {
  const { clinicId } = request.user

  const useCase = makeListActiveHospitalizationsUseCase()
  const hospitalizations = await useCase.execute({ clinicId })

  return reply.status(200).send({ items: hospitalizations.map(toHospitalizationCardResponse) })
}
