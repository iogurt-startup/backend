import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(1),
  // Origens permitidas para CORS. Use '*' para liberar todas (default) ou uma
  // lista separada por vírgula (ex.: "https://iogurt.lablivre.rocks").
  // Com o frontend servido pelo mesmo domínio (via proxy nginx), as chamadas
  // são same-origin e o CORS nem é exercido — isto é uma rede de segurança.
  CORS_ORIGIN: z.string().default('*'),
  PASSWORD_RESET_SECRET: z.string().default(''),
  JWT_EXPIRES_IN: z.string().default('30m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  GEMINI_API_KEY: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.union([z.string().email(), z.literal('')]).default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_FALLBACK_MODELS: z.string().default('gemini-2.5-flash-lite'),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(_env.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = _env.data
