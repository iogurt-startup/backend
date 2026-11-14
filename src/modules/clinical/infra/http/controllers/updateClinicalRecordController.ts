import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeUpdateClinicalRecordUseCase } from '../../../useCases/factories/makeClinicalRecordsUseCases'

export const updateClinicalRecordParamsSchema = z.object({
  id: z.string().uuid(),
})

export const updateClinicalRecordBodySchema = z.object({
  weightKg: z.number().positive().optional(),
  clinicalNotes: z.string().optional(),
  diagnosis: z.string().optional(),
  pendingDiagnosis: z.string().optional(),
  prescriptions: z.string().optional(),
  breathingNotes: z.string().optional(),
  routineGuidance: z.string().optional(),
  // CLI-01 — campo próprio das observações do atendimento. Antes elas eram
  // serializadas em JSON dentro de routineGuidance, que é de outra finalidade.
  observations: z.string().optional(),
})

export async function updateClinicalRecordController(
  request: FastifyRequest<{
    Params: z.infer<typeof updateClinicalRecordParamsSchema>
    Body: z.infer<typeof updateClinicalRecordBodySchema>
  }>,
  reply: FastifyReply
) {
  const { id } = request.params
  const data = request.body
  const vetId = request.user.userId
  const clinicId = request.user.clinicId

  const useCase = makeUpdateClinicalRecordUseCase()

  const record = await useCase.execute({
    recordId: id,
    vetId,
    clinicId,
    data,
  })

  return reply.status(200).send(record)
}
