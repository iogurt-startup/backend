import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeVerifyPasswordTokenUseCase } from '../../../useCases/factories/makeVerifyPasswordTokenUseCase'

export const verifyPasswordTokenQuerySchema = z.object({
  token: z.string().min(1),
})

export async function verifyPasswordTokenController(request: FastifyRequest, reply: FastifyReply) {
  const { token } = verifyPasswordTokenQuerySchema.parse(request.query)
  const result = await makeVerifyPasswordTokenUseCase().execute({ token })
  return reply.status(200).send(result)
}
