import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeAddHospitalizationEvolutionUseCase } from '../../../useCases/factories/makeHospitalizationUseCases'
import { toHospitalizationEvolutionResponse } from '../hospitalizationPresenter'

export const addHospitalizationEvolutionParamsSchema = z.object({
  clinicId: z.string().uuid(),
  id: z.string().uuid(),
})

// Faixas largas de propósito: servem para barrar erro de digitação (FC 2000)
// sem o backend opinar sobre o que é clinicamente normal para cada espécie.
export const addHospitalizationEvolutionBodySchema = z.object({
  temperature: z.number().min(20).max(50).optional(),
  heartRate: z.number().int().min(10).max(400).optional(),
  respiratoryRate: z.number().int().min(2).max(200).optional(),
  mucousMembranes: z.string().trim().max(120).optional(),
  notes: z.string().trim().min(1).max(2000),
})

export async function addHospitalizationEvolutionController(
  request: FastifyRequest<{
    Params: z.infer<typeof addHospitalizationEvolutionParamsSchema>
    Body: z.infer<typeof addHospitalizationEvolutionBodySchema>
  }>,
  reply: FastifyReply
) {
  const { clinicId, userId } = request.user
  const { id } = request.params

  const useCase = makeAddHospitalizationEvolutionUseCase()
  const evolution = await useCase.execute({
    ...request.body,
    hospitalizationId: id,
    clinicId,
    recordedByVetId: userId,
  })

  return reply.status(201).send(toHospitalizationEvolutionResponse(evolution))
}
