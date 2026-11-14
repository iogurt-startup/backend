import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { FAKE, HTTP } from '../../utils/constants'
import { prismaMock } from '../../setup'

const WEB = { 'x-client': 'web' }

type Cookie = { name: string; value: string; httpOnly?: boolean }

describe('Sessão web (cookies HttpOnly + CSRF)', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  async function webLogin() {
    const hashed = await bcrypt.hash(FAKE.PASSWORD, 6)
    prismaMock.user.findUnique.mockResolvedValue(Factory.owner({ passwordHash: hashed }) as never)
    prismaMock.refreshToken.create.mockResolvedValue(Factory.refreshToken() as never)
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: WEB,
      payload: { email: FAKE.EMAIL, password: FAKE.PASSWORD },
    })
    const cookies = response.cookies as Cookie[]
    const get = (name: string) => cookies.find((c) => c.name === name)
    return {
      response,
      cookies,
      csrfToken: response.json().csrfToken as string,
      cookieJar: Object.fromEntries(cookies.map((c) => [c.name, c.value])),
      get,
    }
  }

  describe('login', () => {
    it('web: grava cookies HttpOnly e não expõe tokens no body', async () => {
      const { response, get, csrfToken } = await webLogin()

      expect(response.statusCode).toBe(HTTP.OK)
      const body = response.json()
      expect(body.accessToken).toBeUndefined()
      expect(body.refreshToken).toBeUndefined()
      expect(csrfToken).toEqual(expect.any(String))

      expect(get('accessToken')?.httpOnly).toBe(true)
      expect(get('refreshToken')?.httpOnly).toBe(true)
      expect(get('csrfToken')?.httpOnly).toBe(true)
      expect(get('csrfToken')?.value).toBe(csrfToken)
      expect(response.headers['cache-control']).toBe('no-store')
    })

    it('mobile (sem X-Client): mantém tokens no body e não grava cookies', async () => {
      const hashed = await bcrypt.hash(FAKE.PASSWORD, 6)
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner({ passwordHash: hashed }) as never)
      prismaMock.refreshToken.create.mockResolvedValue(Factory.refreshToken() as never)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: FAKE.EMAIL, password: FAKE.PASSWORD },
      })

      const body = response.json()
      expect(body.accessToken).toEqual(expect.any(String))
      expect(body.refreshToken).toEqual(expect.any(String))
      expect(body.csrfToken).toBeUndefined()
      expect(response.cookies).toHaveLength(0)
      expect(response.headers['cache-control']).toBe('no-store')
    })
  })

  describe('requisições autenticadas por cookie', () => {
    it('GET funciona só com o cookie de acesso', async () => {
      const { cookieJar } = await webLogin()
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { accessToken: cookieJar.accessToken },
      })
      expect(response.statusCode).toBe(HTTP.OK)
    })

    it('PATCH sem header CSRF é rejeitado com 403', async () => {
      const { cookieJar } = await webLogin()

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { accessToken: cookieJar.accessToken, csrfToken: cookieJar.csrfToken },
        payload: { name: 'Dr. Novo' },
      })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('PATCH com header CSRF diferente do cookie é rejeitado com 403', async () => {
      const { cookieJar } = await webLogin()
      const { csrfToken: other } = await webLogin()

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { accessToken: cookieJar.accessToken, csrfToken: cookieJar.csrfToken },
        headers: { 'x-csrf-token': other },
        payload: { name: 'Dr. Novo' },
      })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('rejeita CSRF forjado (par cookie/header iguais, mas sem assinatura válida)', async () => {
      const { cookieJar } = await webLogin()
      const forged = 'abc.def'

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { accessToken: cookieJar.accessToken, csrfToken: forged },
        headers: { 'x-csrf-token': forged },
        payload: { name: 'Dr. Novo' },
      })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('PATCH com cookie + header CSRF válidos é aceito', async () => {
      const { cookieJar, csrfToken } = await webLogin()
      prismaMock.user.update.mockResolvedValue(Factory.owner({ name: 'Dr. Novo' }) as never)

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { accessToken: cookieJar.accessToken, csrfToken: cookieJar.csrfToken },
        headers: { 'x-csrf-token': csrfToken },
        payload: { name: 'Dr. Novo' },
      })
      expect(response.statusCode).toBe(HTTP.OK)
    })

    it('Bearer não exige CSRF (app mobile)', async () => {
      prismaMock.user.update.mockResolvedValue(Factory.owner({ name: 'Dr. Novo' }) as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: '/auth/me',
        payload: { name: 'Dr. Novo' },
      })
      expect(response.statusCode).toBe(HTTP.OK)
    })
  })

  describe('POST /auth/refresh', () => {
    function mockRefresh() {
      prismaMock.refreshToken.findUnique.mockResolvedValue(Factory.refreshToken() as never)
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 } as never)
      prismaMock.refreshToken.create.mockResolvedValue(Factory.refreshToken() as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
    }

    it('web: renova a sessão pelo cookie e rotaciona os cookies', async () => {
      const { cookieJar, csrfToken } = await webLogin()
      mockRefresh()

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { ...WEB, 'x-csrf-token': csrfToken },
        cookies: { refreshToken: FAKE.REFRESH_TOKEN, csrfToken: cookieJar.csrfToken },
        payload: {},
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().accessToken).toBeUndefined()
      expect(response.json().csrfToken).toEqual(expect.any(String))
      expect((response.cookies as Cookie[]).map((c) => c.name)).toEqual(
        expect.arrayContaining(['accessToken', 'refreshToken', 'csrfToken']),
      )
    })

    it('web: rejeita refresh pelo cookie sem CSRF com 403', async () => {
      mockRefresh()
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: WEB,
        cookies: { refreshToken: FAKE.REFRESH_TOKEN },
        payload: {},
      })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('mobile: segue aceitando o refresh token no body', async () => {
      mockRefresh()
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: FAKE.REFRESH_TOKEN },
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().accessToken).toEqual(expect.any(String))
      expect(response.json().refreshToken).toEqual(expect.any(String))
    })

    it('mobile: ignora o cookie de refresh e exige o token no body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { refreshToken: FAKE.REFRESH_TOKEN },
        payload: {},
      })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })
  })

  describe('DELETE /auth/logout', () => {
    it('web: limpa os cookies de sessão', async () => {
      const { cookieJar, csrfToken } = await webLogin()
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 } as never)

      const response = await app.inject({
        method: 'DELETE',
        url: '/auth/logout',
        headers: { 'x-csrf-token': csrfToken },
        cookies: { accessToken: cookieJar.accessToken, csrfToken: cookieJar.csrfToken },
      })

      expect(response.statusCode).toBe(HTTP.NO_CONTENT)
      const cleared = response.cookies as Cookie[]
      for (const name of ['accessToken', 'refreshToken', 'csrfToken']) {
        expect(cleared.find((c) => c.name === name)?.value).toBe('')
      }
    })

    it('web: logout por cookie sem CSRF é rejeitado com 403', async () => {
      const { cookieJar } = await webLogin()
      const response = await app.inject({
        method: 'DELETE',
        url: '/auth/logout',
        cookies: { accessToken: cookieJar.accessToken },
      })
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })
})

describe('Atributos dos cookies de sessão', () => {
  async function loadSession(sameSite: string, nodeEnv = 'test') {
    vi.resetModules()
    vi.stubEnv('COOKIE_SAME_SITE', sameSite)
    vi.stubEnv('NODE_ENV', nodeEnv)
    if (nodeEnv === 'production') {
      // O env.ts valida produção: JWT_SECRET forte e sem E2E_TEST_SECRET.
      vi.stubEnv('JWT_SECRET', 'segredo-de-teste-com-mais-de-16-caracteres')
      vi.stubEnv('E2E_TEST_SECRET', '')
    }
    return import('../../../src/shared/auth/session')
  }

  function captureCookies() {
    const cookies: Array<{ name: string; options: Record<string, unknown> }> = []
    const reply = {
      setCookie: (name: string, _value: string, options: Record<string, unknown>) => {
        cookies.push({ name, options })
      },
    }
    return { reply, cookies }
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('usa HttpOnly, SameSite=lax e sem Secure fora de produção', async () => {
    const { setSessionCookies } = await loadSession('lax')
    const { reply, cookies } = captureCookies()

    setSessionCookies(reply as never, 'access', 'refresh')

    expect(cookies.map((c) => c.name)).toEqual(['accessToken', 'refreshToken', 'csrfToken'])
    for (const { options } of cookies) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' })
    }
  })

  it('marca Secure em produção', async () => {
    const { setSessionCookies } = await loadSession('lax', 'production')
    const { reply, cookies } = captureCookies()

    setSessionCookies(reply as never, 'access', 'refresh')

    for (const { options } of cookies) expect(options.secure).toBe(true)
  })

  it('força Secure quando SameSite=none (senão o navegador rejeita o cookie)', async () => {
    const { setSessionCookies } = await loadSession('none')
    const { reply, cookies } = captureCookies()

    setSessionCookies(reply as never, 'access', 'refresh')

    for (const { options } of cookies) {
      expect(options).toMatchObject({ sameSite: 'none', secure: true })
    }
  })

  it('define maxAge conforme a validade dos tokens', async () => {
    const { setSessionCookies } = await loadSession('lax')
    const { reply, cookies } = captureCookies()

    setSessionCookies(reply as never, 'access', 'refresh')

    const maxAge = Object.fromEntries(cookies.map((c) => [c.name, c.options.maxAge]))
    expect(maxAge.accessToken).toBe(15 * 60) // JWT_EXPIRES_IN=15m nos testes
    expect(maxAge.refreshToken).toBe(7 * 86400) // REFRESH_TOKEN_EXPIRES_IN=7d
    expect(maxAge.csrfToken).toBe(7 * 86400)
  })
})