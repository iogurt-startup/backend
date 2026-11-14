import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeDischargePatientUseCase } from '../../../useCases/factories/makeHospitalizationUseCases'
import { toHospitalizationResponse } from '../hospitalizationPresenter'

export const dischargePatientParamsSchema = z.object({
  clinicId: z.string().uuid(),
  id: z.string().uuid(),
})

export const dischargePatientBodySchema = z.object({
  dischargeNotes: z.string().trim().max(4000).optional(),
})

export async function dischargePatientController(
  request: FastifyRequest<{
    Params: z.infer<typeof dischargePatientParamsSchema>
    Body: z.infer<typeof dischargePatientBodySchema>
  }>,
  reply: FastifyReply
) {
  const { clinicId } = request.user
  const { id } = request.params

  const useCase = makeDischargePatientUseCase()
  const hospitalization = await useCase.execute({
    hospitalizationId: id,
    clinicId,
    dischargeNotes: request.body.dischargeNotes,
  })

  return reply.status(200).send(toHospitalizationResponse(hospitalization))
}
