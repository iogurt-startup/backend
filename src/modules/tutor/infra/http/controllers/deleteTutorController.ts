import type { FastifyRequest, FastifyReply } from 'fastify'
import { makeDeleteTutorUseCase } from '../../../useCases/factories/makeDeleteTutorUseCase'

export async function deleteTutorController(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { clinicId } = request.user
  const useCase = makeDeleteTutorUseCase()
  
  await useCase.execute({
    id: request.params.id,
    clinicId,
  })

  return reply.status(204).send()
}

