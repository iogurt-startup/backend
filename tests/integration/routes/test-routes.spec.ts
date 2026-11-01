import { afterEach, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { HTTP, SEED } from '../../utils/constants'
import { env } from '../../../src/config/env'

const SECRET = 'test-e2e-secret'
const CLINIC_URL = `/test/clinics/${SEED.CLINIC_ID}`

describe('Rotas /test protegidas por segredo', { timeout: 15000 }, () => {
  let app: TestApp

  afterEach(async () => {
    await app?.close()
    env.E2E_TEST_SECRET = SECRET
  })

  it('retorna 403 sem o header x-e2e-secret', async () => {
    app = await TestApp.build()

    const response = await app.inject({ method: 'DELETE', url: CLINIC_URL })

    expect(response.statusCode).toBe(HTTP.FORBIDDEN)
  })

  it('retorna 403 com segredo incorreto', async () => {
    app = await TestApp.build()

    const response = await app.inject({
      method: 'DELETE',
      url: CLINIC_URL,
      headers: { 'x-e2e-secret': 'segredo-errado' },
    })

    expect(response.statusCode).toBe(HTTP.FORBIDDEN)
  })

  it('retorna 403 na rota de token de primeiro acesso sem o segredo', async () => {
    app = await TestApp.build()

    const response = await app.inject({
      method: 'POST',
      url: '/test/first-access-token',
      payload: { email: 'tutor@iougurt.com' },
    })

    expect(response.statusCode).toBe(HTTP.FORBIDDEN)
  })

  it('com o segredo correto a requisição chega ao controller', async () => {
    app = await TestApp.build()

    const response = await app.inject({
      method: 'DELETE',
      url: CLINIC_URL,
      headers: { 'x-e2e-secret': SECRET },
    })

    // Passou pela proteção: a clínica não existe (prisma mockado), então 404 do controller
    expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    expect(response.json().error).toContain('Clínica não encontrada')
  })

  it('não registra as rotas quando E2E_TEST_SECRET está vazio', async () => {
    env.E2E_TEST_SECRET = ''
    app = await TestApp.build()

    const response = await app.inject({
      method: 'DELETE',
      url: CLINIC_URL,
      headers: { 'x-e2e-secret': SECRET },
    })

    expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    expect(response.json().message).toContain('not found')
  })
})
