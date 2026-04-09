import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeUpdatePatientUseCase } from '../../../useCases/factories/makeUpdatePatientUseCase'

export const updatePatientBodySchema = z.object({
  name: z.string().min(1).optional(),
  species: z.string().optional(),
  breed: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  sex: z.string().optional(),
  weightKg: z.number().optional(),
  observations: z.string().optional(),
  microchip: z.string().optional(),
  allergies: z.string().optional(),
  photoUrl: z.string().optional(),
  tutor: z.object({
    fullName: z.string().optional(),
    cpf: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    insurance: z.string().optional(),
  }).optional(),
})

export async function updatePatientController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const body = updatePatientBodySchema.parse(request.body)
  const { tutor, ...patientData } = body
  const useCase = makeUpdatePatientUseCase()
  const patient = await useCase.execute({ id: request.params.id, ...patientData, tutor })
  return reply.status(200).send({ patient })
}
