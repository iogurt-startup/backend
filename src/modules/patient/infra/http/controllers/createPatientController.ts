import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeCreatePatientUseCase } from '../../../useCases/factories/makeCreatePatientUseCase'
import { PATIENT_SEXES, PATIENT_SPECIES, REPRODUCTIVE_CONDITIONS } from '../../../patientFields'

export const createPatientBodySchema = z.object({
  name: z.string().min(1),
  tutorId: z.string().uuid(),
  species: z.enum(PATIENT_SPECIES),
  breed: z.string().trim().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  sex: z.enum(PATIENT_SEXES),
  reproductiveCondition: z.enum(REPRODUCTIVE_CONDITIONS).optional(),
  coatDescription: z.string().trim().min(1).max(500).optional(),
  weightKg: z.number().max(999.99).optional(),
  observations: z.string().optional(),
  microchip: z.string().optional(),
  allergies: z.string().optional(),
  photoUrl: z.string().optional(),
})

export async function createPatientController(request: FastifyRequest, reply: FastifyReply) {
  const body = createPatientBodySchema.parse(request.body)
  const { clinicId } = request.user
  const useCase = makeCreatePatientUseCase()
  const patient = await useCase.execute({ ...body, clinicId })
  return reply.status(201).send({ patient })
}
