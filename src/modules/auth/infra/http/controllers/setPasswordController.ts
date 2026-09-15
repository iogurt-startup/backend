import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeSetPasswordUseCase } from '../../../useCases/factories/makeSetPasswordUseCase'

// Mesmos requisitos exibidos no frontend; 72 é o limite de bytes considerado pelo bcrypt
export const newPasswordSchema = z
  .string()
  .min(6, 'A senha deve ter pelo menos 6 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'A senha deve conter ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'A senha deve conter ao menos um símbolo')

export const setPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: newPasswordSchema,
})

export async function setPasswordController(request: FastifyRequest, reply: FastifyReply) {
  const body = setPasswordBodySchema.parse(request.body)
  await makeSetPasswordUseCase().execute(body)
  return reply.status(204).send()
}
