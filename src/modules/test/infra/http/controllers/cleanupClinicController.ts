import { z } from 'zod'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@config/prisma'
import { AppError } from '@shared/errors/app-error'

export const cleanupClinicParamsSchema = z.object({
  id: z.string().uuid(),
})

type CleanupClinicParams = z.infer<typeof cleanupClinicParamsSchema>

/**
 * [TESTE] Remove uma clínica e TODOS os dados que dependem dela.
 *
 * As foreign keys do schema não usam `onDelete: Cascade` (exceto os tokens de
 * usuário), então a deleção é feita manualmente na ordem inversa das
 * dependências, dentro de uma única transação:
 *
 *   examFiles → vaccinations → clinicalRecords → appointments → budgets
 *   → patients → tutors → users (→ refresh/password tokens via cascade) → clinic
 *
 * Budgets (e seus itens, via cascade) precisam sair antes de patients/tutors,
 * pois suas FKs são RESTRICT.
 */
export async function cleanupClinicController(
  request: FastifyRequest<{ Params: CleanupClinicParams }>,
  reply: FastifyReply,
) {
  const { id: clinicId } = request.params

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) {
    throw new AppError('Clínica não encontrada.', 404)
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const patients = await tx.patient.findMany({
      where: { clinicId },
      select: { id: true },
    })
    const patientIds = patients.map((patient) => patient.id)

    const users = await tx.user.findMany({
      where: { clinicId },
      select: { id: true },
    })
    const userIds = users.map((user) => user.id)

    const records = await tx.clinicalRecord.findMany({
      where: { OR: [{ patientId: { in: patientIds } }, { vetId: { in: userIds } }] },
      select: { id: true },
    })
    const recordIds = records.map((record) => record.id)

    const examFiles = await tx.examFile.deleteMany({
      where: {
        OR: [{ patientId: { in: patientIds } }, { clinicalRecordId: { in: recordIds } }],
      },
    })
    const vaccinations = await tx.vaccination.deleteMany({
      where: { patientId: { in: patientIds } },
    })
    const clinicalRecords = await tx.clinicalRecord.deleteMany({
      where: { id: { in: recordIds } },
    })
    const appointments = await tx.appointment.deleteMany({
      where: { OR: [{ patientId: { in: patientIds } }, { vetId: { in: userIds } }] },
    })
    const budgets = await tx.budget.deleteMany({ where: { clinicId } })
    const patientsDeleted = await tx.patient.deleteMany({ where: { clinicId } })
    const tutors = await tx.tutor.deleteMany({ where: { clinicId } })
    const usersDeleted = await tx.user.deleteMany({ where: { clinicId } })
    await tx.clinic.delete({ where: { id: clinicId } })

    return {
      examFiles: examFiles.count,
      vaccinations: vaccinations.count,
      clinicalRecords: clinicalRecords.count,
      appointments: appointments.count,
      budgets: budgets.count,
      patients: patientsDeleted.count,
      tutors: tutors.count,
      users: usersDeleted.count,
      clinics: 1,
    }
  })

  return reply.status(200).send({
    message: 'Dados de teste removidos.',
    clinicId,
    deleted,
  })
}
