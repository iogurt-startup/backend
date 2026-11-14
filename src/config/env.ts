import { z } from 'zod'

const envSchema = z
  .object({
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
    // SameSite dos cookies de sessão. 'lax' serve quando o frontend é same-site (proxy);
    // use 'none' (exige HTTPS) só se o frontend estiver em outro site.
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    PASSWORD_RESET_SECRET: z.string().default(''),
    JWT_EXPIRES_IN: z.string().default('30m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
    GEMINI_API_KEY: z.string().default(''),
    GOOGLE_CLIENT_ID: z.string().default(''),
    RESEND_API_KEY: z.string().default(''),
    MAIL_FROM: z.union([z.string().email(), z.literal('')]).default(''),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    GEMINI_FALLBACK_MODELS: z.string().default('gemini-2.5-flash-lite'),
    // Controla exposição da UI do Swagger (/docs). Quando omitido, fica ativo apenas fora de produção.
    ENABLE_SWAGGER: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    // Segredo exigido (header x-e2e-secret) pelas rotas /test, usadas só nos testes E2E
    // com NODE_ENV=test. Vazio mantém essas rotas desligadas.
    E2E_TEST_SECRET: z.string().default(''),
    // Diretório onde ficam os arquivos enviados (exames e fotos de pacientes).
    // Precisa apontar para um disco persistente em produção: o conteúdo não vive
    // no banco, então se a pasta ficar dentro do container os arquivos somem a
    // cada redeploy. Default relativo ao processo mantém o comportamento local.
    UPLOADS_DIR: z.string().default('uploads'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.JWT_SECRET === 'change-me-in-production' || data.JWT_SECRET.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'Em produção, JWT_SECRET deve ter ao menos 16 caracteres e não usar o valor padrão de dev.',
        })
      }
      if (data.E2E_TEST_SECRET.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['E2E_TEST_SECRET'],
          message: 'E2E_TEST_SECRET não deve ser definido em produção.',
        })
      }
    }
  })

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(_env.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = _env.data