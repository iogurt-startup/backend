import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { HTTP } from '../../utils/constants'

describe('GET /health', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

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
