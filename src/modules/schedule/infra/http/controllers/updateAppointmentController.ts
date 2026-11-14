import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeUpdateAppointmentUseCase } from '../../../useCases/factories/makeUpdateAppointmentUseCase'

export const updateAppointmentParamsSchema = z.object({ id: z.string().uuid() })

export const updateAppointmentBodySchema = z.object({
  vetId: z.string().uuid().optional(),
  dateTime: z.string().datetime().optional(),
  endDateTime: z.string().datetime().nullable().optional(),
  category: z.enum(['GENERAL', 'RETURN', 'SURGICAL_EVALUATION', 'VACCINATION', 'OBSERVATION', 'EXAM', 'SURGICAL']).optional(),
  observation: z.string().max(2000).nullable().optional(),
}).refine(body => Object.keys(body).length > 0, { message: 'Informe ao menos um campo para editar.' })

export async function updateAppointmentController(
  request: FastifyRequest<{
    Params: z.infer<typeof updateAppointmentParamsSchema>
    Body: z.infer<typeof updateAppointmentBodySchema>
  }>,
  reply: FastifyReply,
) {
  const { id } = updateAppointmentParamsSchema.parse(request.params)
  const body = updateAppointmentBodySchema.parse(request.body)
  const appointment = await makeUpdateAppointmentUseCase().execute({
    ...body,
    appointmentId: id,
    clinicId: request.user.clinicId,
    dateTime: body.dateTime ? new Date(body.dateTime) : undefined,
    endDateTime: body.endDateTime === null ? null : body.endDateTime ? new Date(body.endDateTime) : undefined,
  })
  return reply.status(200).send({ appointment })
}
