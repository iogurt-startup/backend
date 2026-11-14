import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeRefreshTokenUseCase } from '../../../useCases/factories/makeRefreshTokenUseCase'
import type { Role } from '@prisma/client'
import { REFRESH_COOKIE, buildSessionResponse, hasValidCsrf, isWebClient } from '@shared/auth/session'

// Mobile envia o refresh token no body; o web o envia pelo cookie HttpOnly.
export const refreshTokenBodySchema = z.object({ refreshToken: z.string().optional() }).optional()

export async function refreshTokenController(request: FastifyRequest, reply: FastifyReply) {
  const body = refreshTokenBodySchema.parse(request.body)
  const web = isWebClient(request)

  let refreshToken: string | undefined
  if (web) {
    // O cookie é enviado automaticamente pelo navegador, então exige CSRF.
    if (!hasValidCsrf(request)) {
      return reply.status(403).send({ message: 'Token CSRF inválido ou ausente.' })
    }
    refreshToken = request.cookies[REFRESH_COOKIE]
  } else {
    refreshToken = body?.refreshToken
  }

  if (!refreshToken) {
    return reply.status(401).send({ message: 'Refresh token não fornecido.' })
  }

  const useCase = makeRefreshTokenUseCase()
  const result = await useCase.execute({ refreshToken })

  const accessToken = await reply.jwtSign({
    userId: result.user.id,
    role: result.user.role as Role,
    clinicId: result.user.clinicId,
  })

  return reply.status(200).send(
    buildSessionResponse(request, reply, { user: result.user, accessToken, refreshToken: result.refreshToken }),
  )
}
