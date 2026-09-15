import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { createTutorController, createTutorBodySchema } from './controllers/createTutorController'
import { listTutorsController, listTutorsQuerySchema } from './controllers/listTutorsController'
import { getTutorController, getTutorParamsSchema } from './controllers/getTutorController'
import { updateTutorController, updateTutorBodySchema } from './controllers/updateTutorController'
import { createTutorAccountController, createTutorAccountParamsSchema, createTutorAccountBodySchema } from './controllers/createTutorAccountController'
import { resendInviteController, resendInviteParamsSchema } from './controllers/resendInviteController'

export const tutorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', verifyJwt)

  app.post('/', {
    schema: {
      tags: ['Tutors'],
      summary: 'Cadastrar um novo tutor',
      security: [{ bearerAuth: [] }],
      body: createTutorBodySchema,
    },
  }, createTutorController)

  app.get('/', {
    schema: {
      tags: ['Tutors'],
      summary: 'Listar tutores com busca e paginação',
      security: [{ bearerAuth: [] }],
      querystring: listTutorsQuerySchema,
    },
  }, listTutorsController)

  app.get('/:id', {
    schema: {
      tags: ['Tutors'],
      summary: 'Buscar um tutor específico',
      security: [{ bearerAuth: [] }],
      params: getTutorParamsSchema,
    },
  }, getTutorController)

  app.put('/:id', {
    schema: {
      tags: ['Tutors'],
      summary: 'Atualizar dados de um tutor',
      security: [{ bearerAuth: [] }],
      params: getTutorParamsSchema,
      body: updateTutorBodySchema,
    },
  }, updateTutorController)

  app.post('/:id/account', {
    schema: {
      tags: ['Tutors'],
      summary: 'Criar conta de acesso ao portal para o tutor (envia convite por e-mail)',
      security: [{ bearerAuth: [] }],
      params: createTutorAccountParamsSchema,
      body: createTutorAccountBodySchema,
    },
  }, createTutorAccountController)

  app.post('/:id/resend-invite', {
    schema: {
      tags: ['Tutors'],
      summary: 'Reenviar convite de primeiro acesso ao tutor',
      security: [{ bearerAuth: [] }],
      params: resendInviteParamsSchema,
    },
  }, resendInviteController)
}
