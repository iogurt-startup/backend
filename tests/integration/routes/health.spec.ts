import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { prismaMock } from '../../setup'
import { HTTP } from '../../utils/constants'
import { env } from '../../../src/config/env'

describe('Health & Readiness routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('GET /health', () => {
    it('responde 200 com status ok', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' })
      expect(response.statusCode).toBe(HTTP.OK)
      const body = response.json()
      expect(body).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      })
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
    })

    it.each([
      { method: 'POST' as const },
      { method: 'PUT' as const },
      { method: 'DELETE' as const },
      { method: 'PATCH' as const },
    ])('rejeita método $method com 404', async ({ method }) => {
      const response = await app.inject({ method, url: '/health' })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('GET /health/ready', () => {
    it('responde 200 com database up quando o PostgreSQL responde', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }] as never)

      const response = await app.inject({ method: 'GET', url: '/health/ready' })

      expect(response.statusCode).toBe(HTTP.OK)
      const body = response.json()
      expect(body).toEqual({
        status: 'ok',
        database: 'up',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      })
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
    })

    it('responde 503 com database down quando o banco está inacessível', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'))

      const response = await app.inject({ method: 'GET', url: '/health/ready' })

      expect(response.statusCode).toBe(503)
      const body = response.json()
      expect(body).toEqual({
        status: 'error',
        database: 'down',
        timestamp: expect.any(String),
      })
    })

    it.each([
      { method: 'POST' as const },
      { method: 'PUT' as const },
      { method: 'DELETE' as const },
      { method: 'PATCH' as const },
    ])('rejeita método $method com 404', async ({ method }) => {
      const response = await app.inject({ method, url: '/health/ready' })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('Hardening do Swagger (/docs) em produção', () => {
    let prodApp: TestApp | undefined

    afterEach(async () => {
      await prodApp?.close()
      prodApp = undefined
      env.NODE_ENV = 'test'
      env.ENABLE_SWAGGER = undefined
    })

    it('desabilita /docs por padrão quando NODE_ENV=production', async () => {
      env.NODE_ENV = 'production'
      env.ENABLE_SWAGGER = undefined
      prodApp = await TestApp.build()

      const response = await prodApp.inject({ method: 'GET', url: '/docs' })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('permite reabilitar /docs explicitamente com ENABLE_SWAGGER=true', async () => {
      env.NODE_ENV = 'production'
      env.ENABLE_SWAGGER = true
      prodApp = await TestApp.build()

      const response = await prodApp.inject({ method: 'GET', url: '/docs/json' })
      expect(response.statusCode).toBe(HTTP.OK)
    })
  })
})
