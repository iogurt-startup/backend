import type { FastifyRequest, FastifyReply } from 'fastify'
import { makeDeletePatientUseCase } from '../../../useCases/factories/makeDeletePatientUseCase'

export async function deletePatientController(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { clinicId } = request.user
  const useCase = makeDeletePatientUseCase()
  
  await useCase.execute({
    id: request.params.id,
    clinicId,
  })

  return reply.status(204).send()
}

