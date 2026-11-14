import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { startClinicalRecordController, startClinicalRecordBodySchema } from './controllers/startClinicalRecordController'
import { updateClinicalRecordController, updateClinicalRecordParamsSchema, updateClinicalRecordBodySchema } from './controllers/updateClinicalRecordController'
import {
  finalizeClinicalRecordController,
  finalizeClinicalRecordParamsSchema,
} from './controllers/finalizeClinicalRecordController'
import { getPatientHistoryController, getPatientHistoryParamsSchema } from './controllers/getPatientHistoryController'
import { generatePrescriptionController, generatePrescriptionParamsSchema } from './controllers/generatePrescriptionController'
import { generateAISummaryController, generateAISummaryParamsSchema } from './controllers/generateAISummaryController'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'

export const clinicalRoutes: FastifyPluginAsyncZod = async app => {
  app.addHook('onRequest', verifyJwt)

  // Prontuário é da equipe da clínica. A única exceção é a receita em PDF, que
  // o tutor dono do animal baixa pelo portal (a posse é validada no use case).
  const staffOnly = verifyRole('OWNER', 'VET')
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'GET' && request.routeOptions.url?.endsWith('/:id/prescription')) return
    return staffOnly(request, reply)
  })

  app.post(
    '/',
    {
      schema: {
        summary: 'Start Clinical Record',
        tags: ['Clinical Record'],
        body: startClinicalRecordBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    startClinicalRecordController
  )

  app.put(
    '/:id',
    {
      schema: {
        summary: 'Update Clinical Record',
        tags: ['Clinical Record'],
        params: updateClinicalRecordParamsSchema,
        body: updateClinicalRecordBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    updateClinicalRecordController
  )

  app.patch(
    '/:id/finalize',
    {
      schema: {
        summary: 'Finalize Clinical Record',
        tags: ['Clinical Record'],
        params: finalizeClinicalRecordParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    finalizeClinicalRecordController
  )

  app.get(
    '/patient/:patientId',
    {
      schema: {
        summary: 'Get Patient Clinical History',
        tags: ['Clinical Record'],
        params: getPatientHistoryParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    getPatientHistoryController
  )

  app.get(
    '/:id/prescription',
    {
      schema: {
        summary: 'Gerar Receituário em PDF (prontuário deve estar finalizado)',
        tags: ['Clinical Record'],
        params: generatePrescriptionParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    generatePrescriptionController
  )

  app.post(
    '/:id/ai-summary',
    {
      schema: {
        summary: 'Gerar Resumo do Atendimento por IA (Gemini)',
        tags: ['Clinical Record'],
        params: generateAISummaryParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    generateAISummaryController
  )
}
