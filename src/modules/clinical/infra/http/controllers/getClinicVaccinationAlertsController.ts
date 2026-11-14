import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../../../../shared/errors/app-error'
import { makeGetClinicVaccinationAlertsUseCase } from '../../../useCases/factories/makeVaccinationUseCases'

export const getClinicVaccinationAlertsParamsSchema = z.object({
  clinicId: z.string().uuid(),
})

export const getClinicVaccinationAlertsQuerySchema = z.object({
  status: z.enum(['OVERDUE', 'UPCOMING']).optional(),
  days: z.coerce.number().int().min(1).max(365).default(15),
})

export async function getClinicVaccinationAlertsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { clinicId } = getClinicVaccinationAlertsParamsSchema.parse(request.params)
  const { status, days } = getClinicVaccinationAlertsQuerySchema.parse(request.query)

  if (request.user.clinicId !== clinicId) {
    throw new AppError('Acesso não autorizado para esta clínica.', 403)
  }

  const useCase = makeGetClinicVaccinationAlertsUseCase()
  const result = await useCase.execute({ clinicId, status, days })

  return reply.status(200).send(result)
}
