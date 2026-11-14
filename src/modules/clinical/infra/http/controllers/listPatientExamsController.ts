import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeListPatientExamsUseCase } from '../../../useCases/factories/makeExamFilesUseCases'
import { clinicalExamTypeSchema } from '../../../examTypes'

export const listPatientExamsParamsSchema = z.object({
  patientId: z.string().uuid(),
})

export const listPatientExamsQuerySchema = z.object({
  clinicalType: clinicalExamTypeSchema.optional(),
})

type ListPatientExamsQuery = z.infer<typeof listPatientExamsQuerySchema>
type ListPatientExamsParams = z.infer<typeof listPatientExamsParamsSchema>

export async function listPatientExamsController(
  request: FastifyRequest<{
    Params: ListPatientExamsParams
    Querystring: ListPatientExamsQuery
  }>,
  reply: FastifyReply
) {
  const { patientId } = request.params
  const query = request.query as ListPatientExamsQuery | undefined
  const clinicalType = query?.clinicalType

  const useCase = makeListPatientExamsUseCase()

  const exams = await useCase.execute({ patientId, clinicalType })

  return reply.status(200).send({ items: exams })
}
