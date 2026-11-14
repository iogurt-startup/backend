import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeAddVaccinationUseCase } from '../../../useCases/factories/makeVaccinationUseCases'

export const addVaccinationBodySchema = z.object({
  patientId: z.string().uuid(),
  vaccineName: z.string().min(2),
  appliedAt: z.string().datetime().optional(),
  nextDoseAt: z.string().datetime().optional(),
  doseNumber: z.coerce.number().int().positive().optional().nullable(),
  intervalDays: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(['UP_TO_DATE', 'PENDING', 'OVERDUE']),
})

export async function addVaccinationController(
  request: FastifyRequest<{ Body: z.infer<typeof addVaccinationBodySchema> }>,
  reply: FastifyReply
) {
  const data = request.body
  const { clinicId } = request.user

  const useCase = makeAddVaccinationUseCase()

  const vaccination = await useCase.execute({ ...data, clinicId })

  return reply.status(201).send(vaccination)
}
