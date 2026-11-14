import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'
import { createAppointmentController, createAppointmentBodySchema } from './controllers/createAppointmentController'
import { listAppointmentsByDayController, listAppointmentsByDayQuerySchema } from './controllers/listAppointmentsByDayController'
import { cancelAppointmentController, cancelAppointmentParamsSchema, cancelAppointmentBodySchema } from './controllers/cancelAppointmentController'
import { rescheduleAppointmentController, rescheduleAppointmentParamsSchema, rescheduleAppointmentBodySchema } from './controllers/rescheduleAppointmentController'
import { approveAppointmentController, approveAppointmentParamsSchema, approveAppointmentBodySchema } from './controllers/approveAppointmentController'
import { rejectAppointmentController, rejectAppointmentParamsSchema, rejectAppointmentBodySchema } from './controllers/rejectAppointmentController'
import { updateAppointmentBodySchema, updateAppointmentController, updateAppointmentParamsSchema } from './controllers/updateAppointmentController'

export const appointmentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', verifyJwt)
  app.addHook('preHandler', verifyRole('OWNER', 'VET'))

  app.post('/', {
    schema: {
      tags: ['Appointments'],
      summary: 'Agendar uma consulta (VACCINATION, OBSERVATION, EXAM, SURGICAL)',
      security: [{ bearerAuth: [] }],
      body: createAppointmentBodySchema,
    },
  }, createAppointmentController)

  app.get('/', {
    schema: {
      tags: ['Appointments'],
      summary: 'Listar agendamentos do dia ou por status (ex.: PENDING_APPROVAL)',
      security: [{ bearerAuth: [] }],
      querystring: listAppointmentsByDayQuerySchema,
    },
  }, listAppointmentsByDayController)

  app.patch('/:id', {
    schema: {
      tags: ['Appointments'],
      summary: 'Editar dados de um atendimento agendado',
      security: [{ bearerAuth: [] }],
      params: updateAppointmentParamsSchema,
      body: updateAppointmentBodySchema,
    },
  }, updateAppointmentController)

  app.delete('/:id', {
    schema: {
      tags: ['Appointments'],
      summary: 'Cancelar agendamento (requer justificativa)',
      security: [{ bearerAuth: [] }],
      params: cancelAppointmentParamsSchema,
      body: cancelAppointmentBodySchema,
    },
  }, cancelAppointmentController)

  app.patch('/:id/reschedule', {
    schema: {
      tags: ['Appointments'],
      summary: 'Reagendar consulta (apenas status SCHEDULED)',
      security: [{ bearerAuth: [] }],
      params: rescheduleAppointmentParamsSchema,
      body: rescheduleAppointmentBodySchema,
    },
  }, rescheduleAppointmentController)

  app.patch('/:id/approve', {
    preHandler: [verifyRole('OWNER', 'VET')],
    schema: {
      tags: ['Appointments'],
      summary: 'Aprovar solicitação de agendamento (atribui veterinário; apenas PENDING_APPROVAL)',
      security: [{ bearerAuth: [] }],
      params: approveAppointmentParamsSchema,
      body: approveAppointmentBodySchema,
    },
  }, approveAppointmentController)

  app.patch('/:id/reject', {
    preHandler: [verifyRole('OWNER', 'VET')],
    schema: {
      tags: ['Appointments'],
      summary: 'Recusar solicitação de agendamento (requer justificativa; apenas PENDING_APPROVAL)',
      security: [{ bearerAuth: [] }],
      params: rejectAppointmentParamsSchema,
      body: rejectAppointmentBodySchema,
    },
  }, rejectAppointmentController)
}
