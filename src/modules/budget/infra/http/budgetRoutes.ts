import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'
import { Errors } from '../../../../core/errors'
import {
  budgetParamsSchema,
  clinicBudgetsParamsSchema,
  createBudgetBodySchema,
  listBudgetsQuerySchema,
  updateBudgetStatusBodySchema,
} from './budgetSchemas'
import { createBudgetController } from './controllers/createBudgetController'
import { listBudgetsController } from './controllers/listBudgetsController'
import { getBudgetController } from './controllers/getBudgetController'
import { updateBudgetStatusController } from './controllers/updateBudgetStatusController'

// Registrado em /clinics/:clinicId/budgets. O clinicId da URL deve ser o da sessão (JWT).
export const budgetRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', verifyJwt)
  app.addHook('preHandler', verifyRole('OWNER', 'VET'))
  app.addHook('preHandler', async (request) => {
    const { clinicId } = request.params as { clinicId: string }
    if (clinicId !== request.user.clinicId) {
      throw Errors.forbidden('Acesso negado a esta clínica.')
    }
  })

  app.post('/', {
    schema: {
      tags: ['Budgets'],
      summary: 'Criar orçamento (totais calculados no backend)',
      security: [{ bearerAuth: [] }],
      params: clinicBudgetsParamsSchema,
      body: createBudgetBodySchema,
    },
  }, createBudgetController)

  app.get('/', {
    schema: {
      tags: ['Budgets'],
      summary: 'Listar orçamentos da clínica (paginado, filtro opcional por status)',
      security: [{ bearerAuth: [] }],
      params: clinicBudgetsParamsSchema,
      querystring: listBudgetsQuerySchema,
    },
  }, listBudgetsController)

  app.get('/:id', {
    schema: {
      tags: ['Budgets'],
      summary: 'Detalhes de um orçamento com itens, paciente e tutor',
      security: [{ bearerAuth: [] }],
      params: budgetParamsSchema,
    },
  }, getBudgetController)

  app.patch('/:id/status', {
    schema: {
      tags: ['Budgets'],
      summary: 'Alterar status do orçamento (bloqueado após APPROVED)',
      security: [{ bearerAuth: [] }],
      params: budgetParamsSchema,
      body: updateBudgetStatusBodySchema,
    },
  }, updateBudgetStatusController)
}
