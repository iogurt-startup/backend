import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeCreateVetUseCase } from '../../../useCases/factories/makeCreateVetUseCase'

export const registerVetBodySchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  crmv: z.string().trim().min(2, 'CRMV é obrigatório').max(40, 'CRMV inválido'),
  clinicCode: z.string().trim().min(3, 'Código da clínica é obrigatório').max(20, 'Código da clínica inválido'),
})

export async function registerVetController(request: FastifyRequest, reply: FastifyReply) {
  const body = registerVetBodySchema.parse(request.body)
  const useCase = makeCreateVetUseCase()
  const user = await useCase.execute(body)
  return reply.status(201).send({ user })
}
