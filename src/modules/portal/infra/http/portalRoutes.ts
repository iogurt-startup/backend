import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { z } from 'zod'
import { GetTutorDashboardUseCase } from '../../useCases/getTutorDashboardUseCase'
import { GetTutorAlertsUseCase } from '../../useCases/getTutorAlertsUseCase'
import { GetTutorPatientHistoryUseCase } from '../../useCases/getTutorPatientHistoryUseCase'
import { RequestAppointmentUseCase } from '../../useCases/requestAppointmentUseCase'
import { ListTutorAppointmentsUseCase } from '../../useCases/listTutorAppointmentsUseCase'

const patientHistoryParamsSchema = z.object({
  patientId: z.string().uuid(),
})

const requestAppointmentBodySchema = z.object({
  patientId: z.string().uuid(),
  category: z.enum(['GENERAL', 'RETURN', 'SURGICAL_EVALUATION', 'VACCINATION', 'OBSERVATION', 'EXAM', 'SURGICAL']),
  dateTime: z.coerce.date(),
  observation: z.string().optional(),
})

export const portalRoutes: FastifyPluginAsyncZod = async app => {
  app.addHook('onRequest', verifyJwt)

  app.get(
    '/dashboard',
    {
      schema: {
        summary: 'Dashboard do Tutor — pets, agendamentos recentes e vacinas',
        tags: ['Portal do Tutor'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const useCase = new GetTutorDashboardUseCase()
      const result = await useCase.execute({ userId: request.user.userId })
      return reply.status(200).send(result)
    }
  )

  app.get(
    '/alerts',
    {
      schema: {
        summary: 'Alertas do Tutor — vacinas vencidas, próximas e recomendações',
        tags: ['Portal do Tutor'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const useCase = new GetTutorAlertsUseCase()
      const result = await useCase.execute({ userId: request.user.userId })
      return reply.status(200).send(result)
    }
  )

  app.get(
    '/patients/:patientId/history',
    {
      schema: {
        summary: 'Histórico clínico completo do pet (somente leitura)',
        tags: ['Portal do Tutor'],
        params: patientHistoryParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as z.infer<typeof patientHistoryParamsSchema>
      const useCase = new GetTutorPatientHistoryUseCase()
      const result = await useCase.execute({ userId: request.user.userId, patientId })
      return reply.status(200).send(result)
    }
  )

  const handleRequestAppointment = async (request: any, reply: any) => {
    const { patientId, category, dateTime, observation } = request.body as z.infer<typeof requestAppointmentBodySchema>
    const useCase = new RequestAppointmentUseCase()
    const result = await useCase.execute({
      userId: request.user.userId,
      patientId,
      category,
      dateTime,
      observation,
    })
    return reply.status(201).send(result)
  }

  app.post(
    '/appointments/request',
    {
      schema: {
        summary: 'Solicitação de agendamento pelo tutor',
        tags: ['Portal do Tutor'],
        body: requestAppointmentBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    handleRequestAppointment
  )

  app.post(
    '/appointments',
    {
      schema: {
        summary: 'Solicitação de agendamento pelo tutor (alias)',
        tags: ['Portal do Tutor'],
        body: requestAppointmentBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    handleRequestAppointment
  )

  app.get(
    '/appointments',
    {
      schema: {
        summary: 'Listagem de agendamentos e solicitações dos pets do tutor',
        tags: ['Portal do Tutor'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const useCase = new ListTutorAppointmentsUseCase()
      const result = await useCase.execute({ userId: request.user.userId })
      return reply.status(200).send(result)
    }
  )
}
