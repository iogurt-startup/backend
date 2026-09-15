import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  cleanupClinicController,
  cleanupClinicParamsSchema,
} from './controllers/cleanupClinicController'

/**
 * Rota de teste para limpeza de dados (uso em testes E2E).
 *
 * Apaga PERMANENTEMENTE uma clínica e todos os seus dados dependentes.
 * Disponível apenas quando NODE_ENV=test — fora desse ambiente, a rota
 * não é registrada (retorna 404).
 */
export const testRoutes: FastifyPluginAsyncZod = async (app) => {
  if (process.env.NODE_ENV !== 'test') {
    return
  }

  app.delete(
    '/clinics/:id',
    {
      schema: {
        tags: ['Test'],
        summary: '[TESTE] Remove uma clínica e TODOS os seus dados (sem autenticação).',
        params: cleanupClinicParamsSchema,
      },
    },
    cleanupClinicController,
  )
}