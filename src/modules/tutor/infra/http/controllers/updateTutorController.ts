import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { isValidCpf, onlyDigits } from '@shared/documents'
import { makeUpdateTutorUseCase } from '../../../useCases/factories/makeUpdateTutorUseCase'
import { tutorAlternateContactsSchema } from '../../../tutorContact'

export const updateTutorBodySchema = z.object({
  cpf: z
    .string()
    .optional()
    .refine((val) => val === undefined || isValidCpf(val), { message: 'CPF inválido' })
    .transform((val) => (val === undefined ? undefined : onlyDigits(val))),
  fullName: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  insurance: z.string().optional(),
  alternateContacts: tutorAlternateContactsSchema.optional(),
})

export async function updateTutorController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { clinicId } = request.user
  const body = updateTutorBodySchema.parse(request.body)
  const useCase = makeUpdateTutorUseCase()
  const tutor = await useCase.execute({ id: request.params.id, clinicId, ...body })
  return reply.status(200).send({ tutor })
}
