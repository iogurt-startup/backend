import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'
import { chronicConditionListResponseSchema, chronicConditionResponseSchema } from './chronicConditionPresenter'
import {
  createChronicConditionController,
  createChronicConditionBodySchema,
} from './controllers/createChronicConditionController'
import {
  listPatientChronicConditionsController,
  listPatientChronicConditionsParamsSchema,
} from './controllers/listPatientChronicConditionsController'
import {
  updateChronicConditionController,
  updateChronicConditionParamsSchema,
  updateChronicConditionBodySchema,
} from './controllers/updateChronicConditionController'

export const chronicConditionRoutes: FastifyPluginAsyncZod = async app => {
  app.addHook('onRequest', verifyJwt)

  app.get(
    '/patient/:patientId',
    {
      schema: {
        summary: 'List Patient Chronic Conditions',
        tags: ['Chronic Conditions'],
        params: listPatientChronicConditionsParamsSchema,
        response: { 200: chronicConditionListResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    listPatientChronicConditionsController
  )

  app.register(async writeRoutes => {
    writeRoutes.addHook('preHandler', verifyRole('OWNER', 'VET'))

    writeRoutes.post(
      '/',
      {
        schema: {
          summary: 'Create Chronic Condition',
          tags: ['Chronic Conditions'],
          body: createChronicConditionBodySchema,
          response: { 201: chronicConditionResponseSchema },
          security: [{ bearerAuth: [] }],
        },
      },
      createChronicConditionController
    )

    writeRoutes.patch(
      '/:id',
      {
        schema: {
          summary: 'Update Chronic Condition',
          tags: ['Chronic Conditions'],
          params: updateChronicConditionParamsSchema,
          body: updateChronicConditionBodySchema,
          response: { 200: chronicConditionResponseSchema },
          security: [{ bearerAuth: [] }],
        },
      },
      updateChronicConditionController
    )
  })
}
