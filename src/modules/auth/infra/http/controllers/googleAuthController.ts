import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeGoogleAuthUseCase } from '../../../useCases/factories/makeGoogleAuthUseCase'
import type { Role } from '@prisma/client'
import { buildSessionResponse } from '@shared/auth/session'

export const googleAuthBodySchema = z.object({
  accessToken: z.string().min(1, 'accessToken do Google é obrigatório'),
})

export async function googleAuthController(request: FastifyRequest, reply: FastifyReply) {
  const { accessToken } = googleAuthBodySchema.parse(request.body)

  const useCase = makeGoogleAuthUseCase()
  const result = await useCase.execute({ accessToken })

  const jwtToken = await reply.jwtSign({
    userId: result.user.id,
    role: result.user.role as Role,
    clinicId: result.user.clinicId,
  })

  return reply.status(200).send({
    ...buildSessionResponse(request, reply, {
      user: result.user,
      accessToken: jwtToken,
      refreshToken: result.refreshToken,
    }),
    isNewUser: result.isNewUser,
  })
}
