import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OPEN_HOSPITALIZATION_STATUSES } from '../../../repositories/IHospitalizationsRepository'
import { makeUpdateHospitalizationStatusUseCase } from '../../../useCases/factories/makeHospitalizationUseCases'
import { toHospitalizationResponse } from '../hospitalizationPresenter'

export const updateHospitalizationStatusParamsSchema = z.object({
  clinicId: z.string().uuid(),
  id: z.string().uuid(),
})

// DISCHARGED fica fora de propósito: alta tem rota própria, porque grava data
// e orientações.
export const updateHospitalizationStatusBodySchema = z.object({
  status: z.enum(OPEN_HOSPITALIZATION_STATUSES),
})

export async function updateHospitalizationStatusController(
  request: FastifyRequest<{
    Params: z.infer<typeof updateHospitalizationStatusParamsSchema>
    Body: z.infer<typeof updateHospitalizationStatusBodySchema>
  }>,
  reply: FastifyReply
) {
  const { clinicId } = request.user
  const { id } = request.params

  const useCase = makeUpdateHospitalizationStatusUseCase()
  const hospitalization = await useCase.execute({
    hospitalizationId: id,
    clinicId,
    status: request.body.status,
  })

  return reply.status(200).send(toHospitalizationResponse(hospitalization))
}
