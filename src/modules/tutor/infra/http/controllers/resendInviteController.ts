import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeResendInviteUseCase } from '../../../useCases/factories/makeResendInviteUseCase'

export const resendInviteParamsSchema = z.object({
  id: z.string().uuid(),
})

export async function resendInviteController(
  request: FastifyRequest<{
    Params: z.infer<typeof resendInviteParamsSchema>
  }>,
  reply: FastifyReply
) {
  const { id: tutorId } = request.params
  const { clinicId, role } = request.user

  const useCase = makeResendInviteUseCase(request.log)
  const result = await useCase.execute({
    tutorId,
    userClinicId: clinicId,
    userRole: role,
  })

  return reply.status(200).send(result)
}
