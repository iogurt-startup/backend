import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'
import { uploadExamFileController } from './controllers/uploadExamFileController'
import {
  listPatientExamsController,
  listPatientExamsParamsSchema,
  listPatientExamsQuerySchema,
} from './controllers/listPatientExamsController'

export const examRoutes: FastifyPluginAsyncZod = async app => {
  app.addHook('onRequest', verifyJwt)
  // Tutores acessam seus dados só pelo /portal; estas rotas expõem a clínica toda.
  app.addHook('onRequest', verifyRole('OWNER', 'VET'))

  app.post(
    '/upload',
    {
      schema: {
        summary: 'Upload Exam File (Multipart Form-Data)',
        tags: ['Exam Files'],
        security: [{ bearerAuth: [] }],
        // For fastify-multipart, the body type is not cleanly inferable through zod since it's a stream
      },
    },
    uploadExamFileController
  )

  app.get(
    '/patient/:patientId',
    {
      schema: {
        summary: 'List Patient Exam Files',
        tags: ['Exam Files'],
        params: listPatientExamsParamsSchema,
        querystring: listPatientExamsQuerySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    listPatientExamsController
  )
}
