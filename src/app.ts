import fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { env } from './config/env'
import { UPLOADS_DIR, shouldServeInline } from './config/uploads'
import { prisma } from './config/prisma'
import { errorHandler } from './shared/middleware/error-handler'
import { authRoutes } from './modules/auth/infra/http/authRoutes'
import { clinicRoutes } from './modules/clinic/infra/http/clinicRoutes'
import { tutorRoutes } from './modules/tutor/infra/http/tutorRoutes'
import { patientRoutes } from './modules/patient/infra/http/patientRoutes'
import { appointmentRoutes } from './modules/schedule/infra/http/appointmentRoutes'
import { clinicalRoutes } from './modules/clinical/infra/http/clinicalRoutes'
import { vaccinationRoutes } from './modules/clinical/infra/http/vaccinationRoutes'
import { examRoutes } from './modules/clinical/infra/http/examRoutes'
import { chronicConditionRoutes } from './modules/clinical/infra/http/chronicConditionRoutes'
import { photoRoutes } from './modules/clinical/infra/http/photoRoutes'
import { hospitalizationRoutes } from './modules/clinical/infra/http/hospitalizationRoutes'
import { dashboardRoutes } from './modules/dashboard/infra/http/dashboardRoutes'
import { portalRoutes } from './modules/portal/infra/http/portalRoutes'
import { budgetRoutes } from './modules/budget/infra/http/budgetRoutes'
import { testRoutes } from './modules/test/infra/http/testRoutes'

import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod'
import rateLimit from '@fastify/rate-limit'


export function createApp() {
  const app = fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: env.NODE_ENV === 'production',
  })

  // ── Zod Type Provider ────────────────────────────────
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // ── Swagger / OpenAPI ─────────────────────────────────
  const swaggerEnabled = env.ENABLE_SWAGGER ?? env.NODE_ENV !== 'production'
  if (swaggerEnabled) {
    app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'IOUGURT API',
          description: 'API de Gestão Veterinária — MVP 3 (Completo)',
          version: '3.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      transform: jsonSchemaTransform,
    })

    app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
    })
  }

  // ── Plugins ───────────────────────────────────────────
  // Origens vêm de env (CORS_ORIGIN). Default '*' mantém o comportamento antigo
  // (libera todas, sem credenciais). Quando uma lista explícita é configurada,
  // passamos a refletir só essas origens e habilitamos credenciais — o wildcard
  // '*' é incompatível com Access-Control-Allow-Credentials nos navegadores.
  const corsOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const allowAllOrigins = corsOrigins.includes('*')
  // Sem `methods`, o padrão do plugin libera só GET, HEAD e POST, e o navegador
  // bloqueia DELETE, PATCH e PUT em requisições cross-origin (preflight).
  app.register(fastifyCors, {
    origin: allowAllOrigins ? '*' : corsOrigins,
    credentials: !allowAllOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
    cookie: { cookieName: 'accessToken', signed: false },
  })

  app.register(fastifyCookie)

  app.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  })

  app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    setHeaders(reply, filePath) {
      // Sem este if, toda imagem era devolvida como anexo e o navegador baixava
      // o arquivo em vez de exibir — o que inviabiliza galeria de fotos (CLI-05)
      // e a pré-visualização de exames de imagem (CLI-03).
      if (!shouldServeInline(filePath)) {
        reply.header('Content-Disposition', 'attachment')
      }
    },
  })

  app.register(rateLimit, {
    global: false,
  })

  // ── Health Check (Liveness & Readiness) ──────────────
  app.get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }))

  app.get('/health/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return reply.status(200).send({
        status: 'ok',
        database: 'up',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      app.log.error({ error }, 'Falha no readiness check: banco de dados indisponível')
      return reply.status(503).send({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      })
    }
  })

  // ── Routes ────────────────────────────────────────────
  app.register(authRoutes, { prefix: '/auth' })
  app.register(clinicRoutes, { prefix: '/clinics' })
  app.register(tutorRoutes, { prefix: '/tutors' })
  app.register(patientRoutes, { prefix: '/patients' })
  app.register(appointmentRoutes, { prefix: '/appointments' })
  app.register(clinicalRoutes, { prefix: '/clinical-records' })
  app.register(vaccinationRoutes, { prefix: '/vaccinations' })
  app.register(examRoutes, { prefix: '/exams' })
  app.register(chronicConditionRoutes, { prefix: '/chronic-conditions' })
  app.register(photoRoutes, { prefix: '/patient-photos' })
  app.register(hospitalizationRoutes, { prefix: '/clinics/:clinicId/hospitalizations' })
  app.register(dashboardRoutes, { prefix: '/dashboard' })
  app.register(portalRoutes, { prefix: '/portal' })
  app.register(budgetRoutes, { prefix: '/clinics/:clinicId/budgets' })
  app.register(testRoutes, { prefix: '/test' })

  // ── Error Handler ─────────────────────────────────────
  app.setErrorHandler(errorHandler)

  return app
}

export const app = createApp()

export default app
