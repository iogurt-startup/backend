import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeListPatientPhotosUseCase } from '../../../useCases/factories/makePatientPhotoUseCases'

export const listPatientPhotosParamsSchema = z.object({
  patientId: z.string().uuid(),
})

export async function listPatientPhotosController(
  request: FastifyRequest<{ Params: z.infer<typeof listPatientPhotosParamsSchema> }>,
  reply: FastifyReply
) {
  const { patientId } = request.params
  const clinicId = request.user.clinicId

  const useCase = makeListPatientPhotosUseCase()

  const photos = await useCase.execute({ patientId, clinicId })

  return reply.status(200).send({ items: photos })
}
