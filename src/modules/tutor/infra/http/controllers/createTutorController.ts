import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { isValidCpf, onlyDigits } from '@shared/documents'
import { makeCreateTutorUseCase } from '../../../useCases/factories/makeCreateTutorUseCase'
import { tutorAlternateContactsSchema } from '../../../tutorContact'
export const createTutorBodySchema = z.object({
  fullName: z.string().min(2),
  cpf: z
    .string()
    .refine((val) => isValidCpf(val), { message: 'CPF inválido' })
    .transform((val) => onlyDigits(val)),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  address: z.string().optional(),
  insurance: z.string().optional(),
  alternateContacts: tutorAlternateContactsSchema.optional(),
})

export async function createTutorController(request: FastifyRequest, reply: FastifyReply) {
  const body = createTutorBodySchema.parse(request.body)
  const { clinicId } = request.user
  const useCase = makeCreateTutorUseCase()
  const tutor = await useCase.execute({ ...body, clinicId })
  return reply.status(201).send({ tutor })
}
