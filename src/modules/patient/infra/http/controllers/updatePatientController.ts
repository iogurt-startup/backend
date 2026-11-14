import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { isValidCpf, onlyDigits } from '@shared/documents'
import { makeUpdatePatientUseCase } from '../../../useCases/factories/makeUpdatePatientUseCase'
import { PATIENT_SEXES, PATIENT_SPECIES, REPRODUCTIVE_CONDITIONS } from '../../../patientFields'
import { tutorAlternateContactsSchema } from '../../../../tutor/tutorContact'

export const updatePatientBodySchema = z.object({
  name: z.string().min(1).optional(),
  species: z.enum(PATIENT_SPECIES).optional(),
  breed: z.string().trim().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  sex: z.enum(PATIENT_SEXES).optional(),
  reproductiveCondition: z.enum(REPRODUCTIVE_CONDITIONS).nullable().optional(),
  coatDescription: z.string().trim().min(1).max(500).nullable().optional(),
  weightKg: z.number().max(999.99).optional(),
  observations: z.string().optional(),
  microchip: z.string().optional(),
  allergies: z.string().optional(),
  photoUrl: z.string().optional(),
  tutor: z.object({
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
  }).optional(),
})

export async function updatePatientController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { clinicId } = request.user
  const body = updatePatientBodySchema.parse(request.body)
  const useCase = makeUpdatePatientUseCase()
  const patient = await useCase.execute({ id: request.params.id, clinicId, ...body })
  return reply.status(200).send({ patient })
}
