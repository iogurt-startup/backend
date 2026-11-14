import { z } from 'zod'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { hasValidCsrf, requiresCsrf } from '../auth/session'

const accessTokenPayloadSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['OWNER', 'VET', 'TUTOR']),
  clinicId: z.string().min(1),
})

/**
 * Aceita o access token via `Authorization: Bearer` (mobile) ou, na falta dele,
 * via cookie HttpOnly (web). Só a autenticação por cookie é vulnerável a CSRF,
 * então apenas ela exige o token CSRF em métodos que alteram estado.
 */
export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()

    const parsedPayload = accessTokenPayloadSchema.safeParse(request.user)
    if (!parsedPayload.success) {
      return reply.status(401).send({ message: 'Token inválido ou expirado.' })
    }
  } catch {
    return reply.status(401).send({ message: 'Token inválido ou expirado.' })
  }

  const viaCookie = !request.headers.authorization
  if (viaCookie && requiresCsrf(request) && !hasValidCsrf(request)) {
    return reply.status(403).send({ message: 'Token CSRF inválido ou ausente.' })
  }
}
