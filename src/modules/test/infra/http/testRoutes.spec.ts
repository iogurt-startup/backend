import { afterEach, describe, expect, it, vi } from 'vitest'
import { testRoutes } from './testRoutes'

describe('testRoutes', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('não registra a rota de limpeza fora do ambiente de teste', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const app = { delete: vi.fn() }

    await testRoutes(app as never, {} as never)

    expect(app.delete).not.toHaveBeenCalled()
  })

  it('registra a rota de limpeza apenas no ambiente de teste', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const app = { delete: vi.fn() }

    await testRoutes(app as never, {} as never)

    expect(app.delete).toHaveBeenCalledWith(
      '/clinics/:id',
      expect.objectContaining({ schema: expect.any(Object) }),
      expect.any(Function),
    )
  })
})
