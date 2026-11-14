import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'
import { getDailyOverviewController, getDailyOverviewQuerySchema } from './controllers/getDailyOverviewController'
import { getAdminMetricsController } from './controllers/getAdminMetricsController'
import {
  getAdminAppointmentsTrendController,
  getAdminAppointmentsTrendQuerySchema,
} from './controllers/getAdminAppointmentsTrendController'
import {
  getRecentActivitiesController,
  getRecentActivitiesQuerySchema,
} from './controllers/getRecentActivitiesController'

export const dashboardRoutes: FastifyPluginAsyncZod = async app => {
  app.addHook('onRequest', verifyJwt)

  app.get(
    '/daily',
    {
      preHandler: [verifyRole('OWNER', 'VET')],
      schema: {
        summary: 'Get Daily Overview',
        tags: ['Dashboard'],
        querystring: getDailyOverviewQuerySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    getDailyOverviewController
  )

  app.get(
    '/admin',
    {
      preHandler: [verifyRole('OWNER')],
      schema: {
        summary: 'Get Admin Metrics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
      },
    },
    getAdminMetricsController
  )

  app.get(
    '/admin/appointments-trend',
    {
      preHandler: [verifyRole('OWNER')],
      schema: {
        summary: 'Get Admin Appointments Trend',
        tags: ['Dashboard'],
        querystring: getAdminAppointmentsTrendQuerySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    getAdminAppointmentsTrendController
  )

  app.get(
    '/recent-activities',
    {
      preHandler: [verifyRole('OWNER', 'VET')],
      schema: {
        summary: 'Get Recent Dashboard Activities',
        tags: ['Dashboard'],
        querystring: getRecentActivitiesQuerySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    getRecentActivitiesController
  )
}
