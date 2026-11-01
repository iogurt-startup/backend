import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import '@fastify/rate-limit'
import { z } from 'zod'
import { prisma } from '@config/prisma'
import { verifyJwt } from '@shared/middleware/verify-jwt'
import { verifyRole } from '@shared/middleware/verify-role'
import { isValidCnpj, onlyDigits } from '@shared/documents'
import { Errors } from '../../../../core/errors'
import { GetClinicByCodeUseCase } from '../../useCases/getClinicByCodeUseCase'

const clinicSelect = {
  id: true,
  name: true,
  code: true,
  cnpj: true,
  address: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const

export const getClinicByCodeParamsSchema = z.object({
  code: z.string().trim().min(3, 'Código deve ter no mínimo 3 caracteres').max(20, 'Código inválido'),
})

// Rota pública: limita tentativas por IP para impedir a descoberta de siglas por força bruta.
// O limite comporta a validação em tempo real do frontend (debounce enquanto o usuário digita).
export const clinicCodeRateLimit = { max: 30, timeWindow: '1 minute' }

export const getClinicByCodeResponseSchema = z.object({
  clinic: z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string(),
  }),
})

const updateClinicBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  cnpj: z
    .union([z.string(), z.null()])
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        v === null ||
        (typeof v === 'string' && (!v.trim() || isValidCnpj(v))),
      { message: 'CNPJ inválido' },
    ),
  address: z.string().trim().min(3).max(200).nullable().optional(),
  phone: z.string().trim().min(8).max(30).nullable().optional(),
})

export const clinicRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Rota Pública de Validação de Código ──────────────
  app.get('/code/:code', {
    config: { rateLimit: clinicCodeRateLimit },
    schema: {
      tags: ['Clinic'],
      summary: 'Valida se uma clínica existe e possui um Dono (OWNER) ativo através da sigla',
      params: getClinicByCodeParamsSchema,
      response: {
        200: getClinicByCodeResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { code } = request.params as z.infer<typeof getClinicByCodeParamsSchema>
    const useCase = new GetClinicByCodeUseCase()
    const clinic = await useCase.execute(code)
    return reply.status(200).send({ clinic })
  })

  // ── Rotas Protegidas (Exigem JWT) ─────────────────────
  app.get('/me', {
    preHandler: [verifyJwt],
    schema: {
      tags: ['Clinic'],
      summary: 'Retorna a clínica do usuário autenticado',
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const { clinicId } = request.user
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: clinicSelect,
    })
    if (!clinic) throw Errors.notFound('Clínica não encontrada')
    return { clinic }
  })

  app.patch('/me', {
    preHandler: [verifyJwt, verifyRole('OWNER')],
    schema: {
      tags: ['Clinic'],
      summary: 'Atualiza dados cadastrais da clínica (apenas OWNER)',
      body: updateClinicBodySchema,
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const { clinicId } = request.user
    const body = request.body as z.infer<typeof updateClinicBodySchema>

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.cnpj !== undefined) {
      const raw = body.cnpj
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        data.cnpj = null
      } else if (typeof raw === 'string') {
        data.cnpj = onlyDigits(raw) || null
      }
    }
    if (body.address !== undefined) data.address = body.address?.trim() || null
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data,
      select: clinicSelect,
    })
    return { clinic }
  })
}
