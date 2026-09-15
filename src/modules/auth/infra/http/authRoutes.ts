import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import '@fastify/rate-limit'
import { registerOwnerController, registerOwnerBodySchema } from './controllers/registerOwnerController'
import { registerVetController, registerVetBodySchema } from './controllers/registerVetController'
import { authenticateController, authenticateBodySchema } from './controllers/authenticateController'
import { refreshTokenController, refreshTokenBodySchema } from './controllers/refreshTokenController'
import { logoutController } from './controllers/logoutController'
import { googleAuthController, googleAuthBodySchema } from './controllers/googleAuthController'
import { getMeController, updateMeController, updateUserBodySchema } from './controllers/meController'
import { sendForgotPasswordMailController, sendForgotPasswordMailBodySchema } from './controllers/sendForgotPasswordMailController'
import { resetPasswordController, resetPasswordBodySchema } from './controllers/resetPasswordController'
import { verifyPasswordTokenController, verifyPasswordTokenQuerySchema } from './controllers/verifyPasswordTokenController'
import { setPasswordController, setPasswordBodySchema } from './controllers/setPasswordController'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro de OWNER (cria clínica automaticamente)
  app.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Criar conta de Dono de Clínica (cria a clínica automaticamente)',
      body: registerOwnerBodySchema,
    },
  }, registerOwnerController)

  // Registro de VET (apenas OWNER pode criar VETs na sua clínica)
  app.post('/register/vet', {
    preHandler: [verifyJwt, verifyRole('OWNER')],
    schema: {
      tags: ['Auth'],
      summary: 'Criar conta de Veterinário (apenas OWNER)',
      body: registerVetBodySchema,
      security: [{ bearerAuth: [] }],
    },
  }, registerVetController)

  app.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Autenticar com email e senha',
      body: authenticateBodySchema,
    },
  }, authenticateController)

  app.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Renovar o token de acesso (Refresh Token)',
      body: refreshTokenBodySchema,
    },
  }, refreshTokenController)

  app.delete('/logout', {
    preHandler: [verifyJwt],
    schema: {
      tags: ['Auth'],
      summary: 'Encerrar sessão ativa',
      security: [{ bearerAuth: [] }],
    },
  }, logoutController)

  app.post('/google', {
    schema: {
      tags: ['Auth'],
      summary: 'Login / Registro com Google',
      body: googleAuthBodySchema,
    },
  }, googleAuthController)

  app.get('/me', {
    preHandler: [verifyJwt],
    schema: {
      tags: ['Auth'],
      summary: 'Retorna o usuário autenticado (inclui CRMV)',
      security: [{ bearerAuth: [] }],
    },
  }, getMeController)

  app.patch('/me', {
    preHandler: [verifyJwt],
    schema: {
      tags: ['Auth'],
      summary: 'Atualiza o próprio perfil (nome, CRMV)',
      body: updateUserBodySchema,
      security: [{ bearerAuth: [] }],
    },
  }, updateMeController)

  const passwordRateLimit = {
    max: 3,
    timeWindow: '15 minutes',
  }

  app.post('/password/forgot', {
    config: { rateLimit: passwordRateLimit },
    schema: {
      tags: ['Auth'],
      summary: 'Solicitar e-mail de recuperação de senha',
      body: sendForgotPasswordMailBodySchema,
    },
  }, sendForgotPasswordMailController)

  app.post('/password/reset', {
    config: { rateLimit: passwordRateLimit },
    schema: {
      tags: ['Auth'],
      summary: 'Redefinir senha',
      body: resetPasswordBodySchema,
    },
  }, resetPasswordController)

  app.get('/verify-token', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      summary: 'Validar token de primeiro acesso ou recuperação de senha',
      querystring: verifyPasswordTokenQuerySchema,
    },
  }, verifyPasswordTokenController)

  app.post('/set-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      summary: 'Definir senha a partir de um token de primeiro acesso ou recuperação',
      body: setPasswordBodySchema,
    },
  }, setPasswordController)
}
