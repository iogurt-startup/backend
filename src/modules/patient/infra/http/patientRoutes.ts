import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { createPatientController, createPatientBodySchema } from './controllers/createPatientController'
import { listPatientsController, listPatientsQuerySchema } from './controllers/listPatientsController'
import { getPatientController, getPatientParamsSchema } from './controllers/getPatientController'
import { updatePatientController, updatePatientBodySchema } from './controllers/updatePatientController'
import { deletePatientController } from './controllers/deletePatientController'

export const patientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', verifyJwt)

  app.post('/', {
    schema: {
      tags: ['Patients'],
      summary: 'Cadastrar novo paciente (obrigatório tutorId)',
      security: [{ bearerAuth: [] }],
      body: createPatientBodySchema,
    },
  }, createPatientController)

  app.get('/', {
    schema: {
      tags: ['Patients'],
      summary: 'Listar pacientes com paginação e busca (busca por nome ou tutorId)',
      security: [{ bearerAuth: [] }],
      querystring: listPatientsQuerySchema,
    },
  }, listPatientsController)

  app.get('/:id', {
    schema: {
      tags: ['Patients'],
      summary: 'Buscar dados completos de um paciente pelo ID',
      security: [{ bearerAuth: [] }],
      params: getPatientParamsSchema,
    },
  }, getPatientController)

  app.put('/:id', {
    schema: {
      tags: ['Patients'],
      summary: 'Atualizar dados de um paciente e, opcionalmente, do tutor vinculado',
      security: [{ bearerAuth: [] }],
      params: getPatientParamsSchema,
      body: updatePatientBodySchema,
    },
  }, updatePatientController)

  app.delete('/:id', {
    schema: {
      tags: ['Patients'],
      summary: 'Excluir paciente logicamente (Soft Delete)',
      security: [{ bearerAuth: [] }],
      params: getPatientParamsSchema,
    },
  }, deletePatientController)
}
