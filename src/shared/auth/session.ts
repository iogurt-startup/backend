import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '@config/env'

export const ACCESS_COOKIE = 'accessToken'
export const REFRESH_COOKIE = 'refreshToken'
export const CSRF_COOKIE = 'csrfToken'
export const CSRF_HEADER = 'x-csrf-token'
export const CLIENT_HEADER = 'x-client'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * O app web envia `X-Client: web` e recebe a sessão em cookies HttpOnly.
 * Qualquer outro cliente (app mobile) continua com tokens no body + Bearer.
 */
export function isWebClient(request: FastifyRequest): boolean {
  return request.headers[CLIENT_HEADER] === 'web'
}

function durationToSeconds(value: string, fallback: number): number {
  const match = /^(\d+)\s*([smhd]?)$/.exec(value.trim())
  if (!match) return fallback
  const unit = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[match[2] as '' | 's' | 'm' | 'h' | 'd']
  return Number(match[1]) * unit
}

function cookieBase() {
  return {
    path: '/',
    httpOnly: true,
    // SameSite=None só é aceito pelos navegadores em cookies Secure.
    secure: env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'none',
    sameSite: env.COOKIE_SAME_SITE,
  } as const
}

function sign(nonce: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`csrf:${nonce}`).digest('hex')
}

function generateCsrfToken(): string {
  const nonce = randomBytes(24).toString('hex')
  return `${nonce}.${sign(nonce)}`
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

function isValidCsrfToken(token: string): boolean {
  const [nonce, signature, ...rest] = token.split('.')
  return Boolean(nonce && signature) && rest.length === 0 && safeEqual(signature, sign(nonce))
}

/**
 * Double-submit cookie: o token assinado vai no cookie (HttpOnly) e o frontend
 * o reenvia no header `X-CSRF-Token`. Os dois precisam coincidir e a assinatura
 * ser válida. Chamado apenas para requisições autenticadas por cookie.
 */
export function hasValidCsrf(request: FastifyRequest): boolean {
  const cookie = request.cookies[CSRF_COOKIE]
  const header = request.headers[CSRF_HEADER]
  if (!cookie || typeof header !== 'string') return false
  return safeEqual(cookie, header) && isValidCsrfToken(cookie)
}

export function requiresCsrf(request: FastifyRequest): boolean {
  return !SAFE_METHODS.has(request.method.toUpperCase())
}

/** Grava a sessão nos cookies e devolve o token CSRF para o body. */
export function setSessionCookies(reply: FastifyReply, accessToken: string, refreshToken: string): string {
  const csrfToken = generateCsrfToken()
  const refreshMaxAge = durationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN, 7 * 86400)

  reply.setCookie(ACCESS_COOKIE, accessToken, {
    ...cookieBase(),
    maxAge: durationToSeconds(env.JWT_EXPIRES_IN, 1800),
  })
  reply.setCookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), maxAge: refreshMaxAge })
  reply.setCookie(CSRF_COOKIE, csrfToken, { ...cookieBase(), maxAge: refreshMaxAge })

  return csrfToken
}

export function clearSessionCookies(reply: FastifyReply) {
  const { httpOnly: _httpOnly, ...options } = cookieBase()
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    reply.clearCookie(name, options)
  }
}

interface SessionUser { id: string; [key: string]: unknown }

/**
 * Monta a resposta de login/refresh. Web: tokens só em cookies (+ csrfToken no
 * body). Mobile: tokens no body, sem cookies.
 */
export function buildSessionResponse<T extends SessionUser>(
  request: FastifyRequest,
  reply: FastifyReply,
  data: { user: T; accessToken: string; refreshToken: string },
) {
  // A resposta carrega credenciais (cookies ou tokens): nunca deve ir para cache.
  reply.header('Cache-Control', 'no-store')
  if (isWebClient(request)) {
    const csrfToken = setSessionCookies(reply, data.accessToken, data.refreshToken)
    return { user: data.user, csrfToken }
  }
  return { user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken }
}
