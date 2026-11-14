import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OPEN_HOSPITALIZATION_STATUSES } from '../../../repositories/IHospitalizationsRepository'
import { makeAdmitPatientUseCase } from '../../../useCases/factories/makeHospitalizationUseCases'
import { toHospitalizationResponse } from '../hospitalizationPresenter'

export const admitPatientParamsSchema = z.object({
  clinicId: z.string().uuid(),
})

export const admitPatientBodySchema = z.object({
  patientId: z.string().uuid(),
  bedIdentifier: z.string().trim().min(1).max(60),
  reason: z.string().trim().min(3).max(2000),
  // Permite admitir já como CRITICAL. Em branco, o caso de uso usa ADMITTED.
  status: z.enum(OPEN_HOSPITALIZATION_STATUSES).optional(),
})

export async function admitPatientController(
  request: FastifyRequest<{
    Params: z.infer<typeof admitPatientParamsSchema>
    Body: z.infer<typeof admitPatientBodySchema>
  }>,
  reply: FastifyReply
) {
  // A clínica vem do token, não do path. O path já foi conferido contra o
  // token no preHandler das rotas; usar o token aqui é a garantia final.
  const { clinicId, userId } = request.user

  const useCase = makeAdmitPatientUseCase()
  const hospitalization = await useCase.execute({
    ...request.body,
    clinicId,
    admittedByVetId: userId,
  })

  return reply.status(201).send(toHospitalizationResponse(hospitalization))
}
