// Validação automatizada de prontidão, contratos HTTP e segurança da API em produção (WEB-05 — Camada 1).
// Uso:
//   PROD_BASE_URL=https://seu-dominio.com node scripts/smoke-prod-api.mjs
//   ou PROD_API_URL=https://seu-dominio.com/api node scripts/smoke-prod-api.mjs

const rawBaseUrl = process.env.PROD_API_URL || (
  process.env.PROD_BASE_URL
    ? `${process.env.PROD_BASE_URL.replace(/\/+$/, '')}/api`
    : ''
)

if (!rawBaseUrl) {
  console.error('Erro: defina PROD_API_URL ou PROD_BASE_URL para executar o smoke check.')
  process.exit(1)
}

const API_BASE = rawBaseUrl.replace(/\/+$/, '')
const MAX_RETRIES = Number(process.env.SMOKE_RETRIES ?? 6)
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 3000)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { url, status: response.status, headers: response.headers, text, json }
}

async function waitForReady() {
  let lastError = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await request('/health/ready')
      if (res.status === 200 && res.json?.status === 'ok' && res.json?.database === 'up') {
        console.log(`[OK] Readiness check: ${res.url} -> 200 (database: up)`)
        return
      }
      lastError = new Error(`Status ${res.status} em ${res.url}: ${res.text}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < MAX_RETRIES) {
      console.log(`[WAIT] Aguardando readiness (${attempt}/${MAX_RETRIES})...`)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
  throw lastError
}

async function main() {
  console.log(`Iniciando Smoke Check da API em: ${API_BASE}`)

  await waitForReady()

  const health = await request('/health')
  assert(health.status === 200 && health.json?.status === 'ok', `GET /health falhou: ${health.status} ${health.text}`)
  console.log('[OK] Liveness check: GET /health -> 200')

  const testTokenRoute = await request('/test/first-access-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@iougurt.com' }),
  })
  assert(
    testTokenRoute.status === 404,
    `FALHA DE SEGURANÇA: POST /test/first-access-token retornou ${testTokenRoute.status} (esperado 404 em produção)`
  )
  console.log('[OK] Blindagem de testes: POST /test/first-access-token -> 404')

  const testCleanupRoute = await request('/test/clinics/11111111-1111-4111-8111-111111111111', {
    method: 'DELETE',
  })
  assert(
    testCleanupRoute.status === 404,
    `FALHA DE SEGURANÇA: DELETE /test/clinics/:id retornou ${testCleanupRoute.status} (esperado 404 em produção)`
  )
  console.log('[OK] Blindagem de testes: DELETE /test/clinics/:id -> 404')

  const unauthPatients = await request('/patients')
  assert(
    unauthPatients.status === 401,
    `GET /patients sem autenticação retornou ${unauthPatients.status} (esperado 401)`
  )
  console.log('[OK] Proteção JWT: GET /patients sem token -> 401')

  if (process.env.EXPECT_SWAGGER_DISABLED === 'true') {
    const docs = await request('/docs')
    assert(docs.status === 404, `GET /docs retornou ${docs.status} (esperado 404 com Swagger desabilitado)`)
    console.log('[OK] Hardening Swagger: GET /docs -> 404')
  }

  const ownerEmail = process.env.PROD_SMOKE_OWNER_EMAIL?.trim()
  const ownerPassword = process.env.PROD_SMOKE_OWNER_PASSWORD
  const requireCreds = process.env.SMOKE_REQUIRE_CREDENTIALS === 'true'

  if (!ownerEmail || !ownerPassword) {
    if (requireCreds) {
      throw new Error(
        'SMOKE_REQUIRE_CREDENTIALS=true, mas PROD_SMOKE_OWNER_EMAIL / PROD_SMOKE_OWNER_PASSWORD não foram informados.'
      )
    }
    console.log('[INFO] Credenciais Canary não informadas; checks autenticados da API ignorados.')
  } else {
    const login = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    })
    assert(login.status === 200 && login.json?.accessToken, `Login Canary falhou: ${login.status}`)
    const token = login.json.accessToken
    console.log('[OK] Autenticação Canary: POST /auth/login -> 200')

    const authHeaders = { Authorization: `Bearer ${token}` }

    const me = await request('/auth/me', { headers: authHeaders })
    assert(me.status === 200 && me.json?.user?.email === ownerEmail, `GET /auth/me falhou: ${me.status}`)
    console.log('[OK] Sessão autenticada: GET /auth/me -> 200')

    const adminDashboard = await request('/dashboard/admin', { headers: authHeaders })
    assert(adminDashboard.status === 200, `GET /dashboard/admin falhou: ${adminDashboard.status}`)
    console.log('[OK] Leitura gerencial + DB: GET /dashboard/admin -> 200')

    const logout = await request('/auth/logout', { method: 'DELETE', headers: authHeaders })
    assert(logout.status === 204, `DELETE /auth/logout falhou: ${logout.status}`)
    console.log('[OK] Encerramento de sessão: DELETE /auth/logout -> 204')
  }

  console.log('Smoke Check da API concluído com sucesso.')
}

main().catch((error) => {
  console.error('[FAIL] Smoke Check da API falhou:', error)
  process.exit(1)
})
