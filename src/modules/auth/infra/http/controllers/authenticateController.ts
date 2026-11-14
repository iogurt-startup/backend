import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeAuthenticateUseCase } from '../../../useCases/factories/makeAuthenticateUseCase'
import type { Role } from '@prisma/client'
import { buildSessionResponse } from '@shared/auth/session'

export const authenticateBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function authenticateController(request: FastifyRequest, reply: FastifyReply) {
  const body = authenticateBodySchema.parse(request.body)
  const useCase = makeAuthenticateUseCase()
  const result = await useCase.execute(body)

  const accessToken = await reply.jwtSign({
    userId: result.user.id,
    role: result.user.role as Role,
    clinicId: result.user.clinicId,
  })

  return reply.status(200).send(
    buildSessionResponse(request, reply, { user: result.user, accessToken, refreshToken: result.refreshToken }),
  )
}

