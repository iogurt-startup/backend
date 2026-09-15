# IOUGURT — Documentação Técnica do Backend

> Guia completo para apresentação à equipe. Cobre arquitetura, tecnologias, banco de dados, endpoints e fluxos de negócio.

---

## 1. Visão Geral do Projeto

O **IOUGURT** é um sistema de gestão para clínicas veterinárias. O backend é uma **API REST** desenvolvida em **Node.js com TypeScript**, seguindo os princípios da **Clean Architecture**. Ele foi construído em 3 MVPs incrementais.

### Stack Tecnológica

| Camada | Tecnologia | Por quê? |
|---|---|---|
| **Runtime** | Node.js 20 (Alpine) | Leve, moderno, suporte nativo a ESM |
| **Linguagem** | TypeScript | Tipagem estática, segurança em tempo de compilação |
| **Framework HTTP** | Fastify | Mais rápido que Express, suporte nativo a JSON Schema |
| **ORM / Banco** | Prisma + PostgreSQL | Schema declarativo, migrations versionadas, type-safe |
| **Autenticação** | JWT + Refresh Token (cookie) | Stateless e seguro |
| **Validação** | Zod + fastify-type-provider-zod | Validação e tipagem unificadas |
| **Documentação** | Swagger/OpenAPI (@fastify/swagger) | Auto-gerado a partir dos schemas Zod |
| **Upload de Arquivos** | @fastify/multipart | Suporte a PDF e imagens (exames) |
| **PDF** | pdfkit | Geração de receituário veterinário |
| **IA** | Google Gemini 2.5 Flash | Resumo simplificado do atendimento |
| **Testes** | Vitest | Rápido, compatível com ESM, zero config |
| **Infraestrutura** | Docker + Docker Compose | Ambiente reproduzível dev/prod |

---

## 2. Como Rodar Localmente

### Pré-requisitos
- Docker e Docker Compose instalados

### Subir o projeto
```bash
# 1ª vez ou após instalar novas dependências (reconstrói a imagem)
docker compose up --build -V

# Demais vezes
docker compose up
```

### Acessar
| Serviço | URL |
|---|---|
| API | `http://localhost:3001` |
| Swagger UI | `http://localhost:3001/docs` |
| Health Check | `http://localhost:3001/health` |
| PostgreSQL | `localhost:5432` |

### Variáveis de Ambiente (`.env`)
```env
DATABASE_URL=postgresql://iougurt:iougurt@db:5432/iougurt
PORT=3000
NODE_ENV=development
JWT_SECRET=sua-chave-secreta
JWT_EXPIRES_IN=30m
REFRESH_TOKEN_EXPIRES_IN=7d
GEMINI_API_KEY=sua-chave-gemini   # necessário para o endpoint de IA
```

---

## 3. Arquitetura — Clean Architecture

O projeto é organizado em **módulos independentes**, cada um com suas próprias camadas. Essa separação garante que as **regras de negócio não dependam de detalhes técnicos** (banco de dados, HTTP, etc).

```
src/
├── server.ts          # Ponto de entrada — inicia o servidor Fastify
├── app.ts             # Registra plugins, middlewares e rotas
├── config/            # Configurações globais (env, prisma client)
├── shared/            # Código reutilizável entre módulos
│   ├── errors/        # AppError — erro domínio padronizado
│   └── middleware/    # verify-jwt, error-handler
└── modules/           # Um por domínio de negócio
    ├── auth/
    ├── tutor/
    ├── patient/
    ├── schedule/
    ├── clinical/
    ├── dashboard/
    └── portal/
```

### Camadas dentro de cada módulo

```
módulo/
├── repositories/
│   ├── IXxxRepository.ts           # Interface (contrato)
│   └── in-memory/                  # Implementação para testes
├── useCases/
│   ├── xyzUseCase.ts               # Regra de negócio pura
│   ├── factories/                  # Cria UseCases com dependências reais
│   └── xyz.spec.ts                 # Testes unitários
└── infra/
    ├── repositories/
    │   └── PrismaXxxRepository.ts  # Implementação real (banco)
    └── http/
        ├── controllers/            # Recebe req → chama useCase → resposta
        └── xxxRoutes.ts            # Define rotas + schema Swagger
```

### Por que essa estrutura?

| Princípio | Resultado prático |
|---|---|
| **Separação de camadas** | UseCase não sabe que usa Fastify. Pode ser testado sem HTTP. |
| **Inversão de dependência** | UseCase recebe um `IRepository`, não um `PrismaRepository`. Troca de banco sem alterar regras. |
| **Repositories in-memory** | Testes rodam sem banco real — rápidos e isolados. |
| **Factories** | Único lugar que conecta "Use Case + Repositório Prisma". Controllers são finos. |

---

## 4. O Banco de Dados (Prisma + PostgreSQL)

### Como o Prisma funciona

O Prisma é um ORM (mapeador objeto-relacional). Você define o **schema** em `prisma/schema.prisma` e ele:

1. **Gera as migrations** (arquivos SQL versionados em `prisma/migrations/`)
2. **Gera o Prisma Client** — um objeto TypeScript com autocompletar para todas as queries
3. Valida as queries **em tempo de compilação**

### Comandos úteis

```bash
# Criar uma migration nova após mudar o schema
npx prisma migrate dev --name nome-da-mudança

# Visualizar os dados do banco num browser
npx prisma studio

# Regenerar o client após mudanças no schema
npx prisma generate
```

### Relacionamentos do banco

```
User ──────── RefreshToken   (1:N)
User ──────── Tutor          (1:1 opcional — conta do portal)
Tutor ─────── Patient        (1:N)
Patient ───── Appointment    (1:N)
Appointment ── ClinicalRecord (1:1)
Patient ───── ClinicalRecord  (1:N)
Patient ───── Vaccination     (1:N)
Patient ───── ExamFile        (1:N)
ClinicalRecord ── ExamFile    (1:N opcional)
```

### Modelo físico (DDL)

O DDL completo está versionado em [`prisma/physical_model.sql`](./prisma/physical_model.sql) — gerado a partir do `schema.prisma` via `prisma migrate diff --from-empty --script`. Inclui enums, tabelas, índices e foreign keys.

**Constraints únicas notáveis (multi-tenancy por clínica):**

- `tutors`: `UNIQUE(cpf, clinic_id)` e `UNIQUE(email, clinic_id)` — o mesmo CPF pode existir em clínicas diferentes.
- `users.email`: único globalmente (login).
- `clinical_records.appointment_id`: `UNIQUE` — garante 1:1 com `appointments`.

### Enums importantes

```
Role:                OWNER | VET | TUTOR
AppointmentStatus:   SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
AppointmentCategory: VACCINATION | OBSERVATION | EXAM | SURGICAL
VaccinationStatus:   UP_TO_DATE | PENDING | OVERDUE
```

---

## 5. Autenticação e Segurança

### Fluxo de Login

```
[POST /auth/login]
  → Valida email + senha (bcrypt compare)
  → Gera access token JWT (30min)
  → Gera refresh token (7 dias, salvo no banco)
  → Retorna JWT no body + refreshToken no cookie HttpOnly
```

### Fluxo de Renovação

```
[POST /auth/refresh]
  → Lê o cookie refreshToken
  → Valida no banco (existe e não expirou)
  → Gera novos tokens
```

### Proteção de Rotas

Toda rota protegida usa o middleware `verifyJwt`:

```typescript
// O Fastify valida a assinatura do JWT automaticamente
await request.jwtVerify()

// O userId e role ficam disponíveis em:
request.user.userId
request.user.role
```

### Roles

| Role | Acesso |
|---|---|
| `OWNER` | Tudo — incluindo métricas gerenciais |
| `VET` | Prontuários, pacientes, agenda, vacinas, exames |
| `TUTOR` | Apenas o `/portal` — leitura dos seus próprios pets |

---

## 6. Todos os Endpoints — por MVP

### MVP 1 — Base Operacional

#### Auth (`/auth`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Criar conta de OWNER e sua clínica | ❌ |
| `POST` | `/auth/register/vet` | Criar conta de veterinário (apenas OWNER) | 🔒 |
| `POST` | `/auth/login` | Login com email/senha | ❌ |
| `POST` | `/auth/refresh` | Renovar access token | ❌ |
| `DELETE` | `/auth/logout` | Encerrar sessão | 🔒 |
| `POST` | `/auth/google` | Login ou cadastro com Google | ❌ |
| `GET` | `/auth/me` | Consultar usuário autenticado | 🔒 |
| `PATCH` | `/auth/me` | Atualizar o próprio perfil | 🔒 |
| `POST` | `/auth/password/forgot` | Solicitar recuperação de senha | ❌ |
| `POST` | `/auth/password/reset` | Redefinir senha com token | ❌ |

#### Clínica (`/clinics`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `GET` | `/clinics/me` | Consultar a clínica do usuário autenticado | 🔒 |
| `PATCH` | `/clinics/me` | Atualizar dados da clínica (apenas OWNER) | 🔒 |

#### Tutores (`/tutors`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/tutors` | Cadastrar tutor | 🔒 |
| `GET` | `/tutors` | Listar com busca e paginação | 🔒 |
| `GET` | `/tutors/:id` | Buscar tutor por ID | 🔒 |
| `PUT` | `/tutors/:id` | Atualizar dados | 🔒 |
| `POST` | `/tutors/:id/account` | Criar login do tutor no portal | 🔒 |

#### Pacientes (`/patients`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/patients` | Cadastrar paciente (requer tutorId) | 🔒 |
| `GET` | `/patients` | Listar com paginação e busca | 🔒 |
| `GET` | `/patients/:id` | Buscar paciente por ID | 🔒 |
| `PUT` | `/patients/:id` | Atualizar dados | 🔒 |

#### Agendamentos (`/appointments`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/appointments` | Criar agendamento | 🔒 |
| `GET` | `/appointments` | Listar agendamentos do dia | 🔒 |
| `DELETE` | `/appointments/:id` | Cancelar (requer justificativa) | 🔒 |
| `PATCH` | `/appointments/:id/reschedule` | Reagendar (requer data futura) | 🔒 |

---

### MVP 2 — Módulo Clínico

#### Prontuários (`/clinical-records`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/clinical-records` | Iniciar atendimento (→ IN_PROGRESS) | 🔒 |
| `PUT` | `/clinical-records/:id` | Atualizar dados clínicos | 🔒 |
| `PATCH` | `/clinical-records/:id/finalize` | Finalizar (→ COMPLETED) | 🔒 |
| `GET` | `/clinical-records/patient/:id` | Histórico clínico do paciente | 🔒 |
| `GET` | `/clinical-records/:id/prescription` | Gerar receituário em PDF | 🔒 |
| `POST` | `/clinical-records/:id/ai-summary` | Gerar resumo por IA (Gemini) | 🔒 |

#### Vacinações (`/vaccinations`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/vaccinations` | Registrar vacina | 🔒 |
| `GET` | `/vaccinations/patient/:id` | Listar vacinas do paciente | 🔒 |
| `PATCH` | `/vaccinations/:id/status` | Atualizar status | 🔒 |

#### Exames (`/exams`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/exams/upload` | Upload de arquivo via multipart | 🔒 |
| `GET` | `/exams/patient/:id` | Listar exames do paciente | 🔒 |

#### Dashboard (`/dashboard`)
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `GET` | `/dashboard/daily` | Visão do dia (VET ou OWNER) | 🔒 |
| `GET` | `/dashboard/admin` | Métricas gerenciais (só OWNER) | 🔒 |
| `GET` | `/dashboard/admin/appointments-trend` | Tendência de agendamentos (só OWNER) | 🔒 |

---

### MVP 3 — Portal do Tutor e Complementares

#### Portal do Tutor (`/portal`) — só `role: TUTOR`
| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `GET` | `/portal/dashboard` | Dashboard: pets, agendamentos, vacinas | 🔒 |
| `GET` | `/portal/alerts` | Alertas iougurt Care | 🔒 |
| `GET` | `/portal/patients/:id/history` | Histórico do pet em leitura | 🔒 |

---

## 7. Fluxo Completo de um Atendimento

```
1. [POST /appointments]
   Atendente agenda a consulta → status: SCHEDULED

2. [POST /clinical-records]  { appointmentId }
   Vet inicia o atendimento → status: IN_PROGRESS
   Prontuário criado e vinculado ao agendamento

3. [PUT /clinical-records/:id]
   Vet preenche: peso, notas clínicas, diagnóstico, prescrições, orientações

4. [POST /vaccinations]  (se necessário)
   Vet registra vacinas aplicadas na consulta

5. [POST /exams/upload]  (se necessário)
   Vet ou atendente anexa resultados de exames

6. [PATCH /clinical-records/:id/finalize]
   Vet finaliza o atendimento → status: COMPLETED
   Prontuário travado para edição

7. [GET /clinical-records/:id/prescription]
   Sistema gera PDF do receituário → download automático

8. [POST /clinical-records/:id/ai-summary]
   IA (Gemini) gera resumo simplificado para a recepção
```

---

## 8. Como Funciona o Código — Passo a Passo

### Exemplo: Criar um Agendamento

**1. A requisição chega no Fastify:**
```
POST /appointments
Body: { patientId, vetId, dateTime, category }
```

**2. `appointmentRoutes.ts` passa para o controller:**
```typescript
app.post('/', { schema: { body: createAppointmentBodySchema, ... } }, createAppointmentController)
```

**3. `createAppointmentController.ts` extrai os dados e chama a factory:**
```typescript
const useCase = makeCreateAppointmentUseCase()  // monta com repositórios Prisma
const result  = await useCase.execute({ patientId, vetId, dateTime, category })
reply.status(201).send(result)
```

**4. `makeCreateAppointmentUseCase.ts` (factory) conecta as dependências:**
```typescript
const appointmentsRepo = new PrismaAppointmentsRepository()
const patientsRepo     = new PrismaPatientsRepository()
const usersRepo        = new PrismaUsersRepository()
return new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
```

**5. `createAppointmentUseCase.ts` executa a regra de negócio:**
```typescript
// Valida se paciente existe
// Valida se veterinário existe e tem role VET
// Cria o agendamento com status SCHEDULED
const appointment = await this.appointmentsRepository.create({ ... })
return appointment
```

**6. Se algo falhar:**
```typescript
throw new AppError('Paciente não encontrado.', 404)
// O error handler global captura e retorna:
// { "message": "Paciente não encontrado.", "statusCode": 404 }
```

---

## 9. Testes

O projeto tem **duas camadas de testes**, ambas rodando em **Vitest**:

1. **Testes unitários de Use Case** (já existentes) — usam repositórios `InMemory*` e validam regras de negócio puras.
2. **Testes de integração de rota** (`tests/integration/routes/`) — sobem a aplicação Fastify completa via `app.inject()` e validam o ciclo HTTP de ponta a ponta com Prisma mockado (`vitest-mock-extended`).

### Resultado atual

```
Test Files  25 passed (25)
     Tests  191 passed (191)
Coverage   Statements 86.52% | Branches 81.95% | Functions 89.83% | Lines 86.52%
```

### Scripts disponíveis

```bash
npm test                 # roda toda a suite (use case + integração)
npm run test:watch       # modo watch
npm run test:routes      # somente os testes de rota
npm run test:coverage    # gera relatório em ./coverage (text, html, lcov, json)
```

Abra `coverage/index.html` para o relatório navegável por arquivo.

### Estrutura do diretório `tests/`

```
tests/
├── setup.ts                       # mock global de Prisma, Resend, Gemini, Google Auth
├── utils/
│   ├── constants.ts               # HTTP, ROLE, APPOINTMENT, SEED, FAKE
│   ├── factories.ts               # classe Factory: clinic(), owner(), tutor(), patient(), ...
│   └── app-builder.ts             # classe TestApp: build(), injectAuth(), signToken()
└── integration/routes/
    ├── auth.spec.ts               # 21 testes — register, login, refresh, logout, me, password
    ├── clinic.spec.ts             # 10 testes — get/patch /clinics/me + verifyRole
    ├── tutor.spec.ts              # 12 testes
    ├── patient.spec.ts            #  9 testes
    ├── appointment.spec.ts        # 17 testes
    ├── clinical.spec.ts           # 14 testes (inclui geração de PDF)
    ├── vaccination.spec.ts        #  9 testes
    ├── exam.spec.ts               #  5 testes
    ├── dashboard.spec.ts          #  9 testes
    ├── portal.spec.ts             #  7 testes
    └── health.spec.ts             #  5 testes
```

### Como um teste de integração é escrito

```typescript
// tests/integration/routes/appointment.spec.ts
describe('POST /appointments', () => {
  it.each(APPOINTMENT.CATEGORIES)(
    'cria agendamento da categoria %s com 201',
    async (category) => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.appointment.create.mockResolvedValue(Factory.appointment({ category }) as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/appointments',
        payload: validBody(category),
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().appointment.category).toBe(category)
    },
  )
})
```

Pontos a observar:
- `it.each(APPOINTMENT.CATEGORIES)` — **teste parametrizado** percorre as 4 categorias em um único caso.
- `HTTP.CREATED`, `APPOINTMENT.CATEGORIES` — **sem magic numbers/strings**.
- `Factory.*`, `app.injectAuth` — **sem repetição**, dependências encapsuladas em classes.

---

## 10. Histórias de Usuário × Implementação × Critérios PC2

Tabela-resumo das US01–US16. As histórias complementares US17–US20 estão documentadas em [us_stories.md](./us_stories.md), com critérios de aceite e rastreabilidade para as rotas e testes.

| US | Feature | Rota(s) | Spec de integração |
|---|---|---|---|
| US01 | Login/Logout | `POST /auth/login`, `DELETE /auth/logout` | `tests/integration/routes/auth.spec.ts` |
| US02 | Painel Inicial | `GET /dashboard/daily` | `tests/integration/routes/dashboard.spec.ts` |
| US03 | Dashboard Gerencial | `GET /dashboard/admin`, `/admin/appointments-trend` | `tests/integration/routes/dashboard.spec.ts` |
| US04 | Listagem de Pacientes | `GET /patients` | `tests/integration/routes/patient.spec.ts` |
| US05 | Cadastro Paciente e Tutor | `POST /patients`, `POST /tutors` | `tests/integration/routes/{patient,tutor}.spec.ts` |
| US06 | Agenda Diária | `GET /appointments` | `tests/integration/routes/appointment.spec.ts` |
| US07 | Criar Agendamento | `POST /appointments` | `tests/integration/routes/appointment.spec.ts` |
| US08 | Cancelar/Reagendar | `DELETE /appointments/:id`, `PATCH .../reschedule` | `tests/integration/routes/appointment.spec.ts` |
| US09 | Registro de Atendimento | `POST /clinical-records` + `PUT` + `PATCH /finalize` | `tests/integration/routes/clinical.spec.ts` |
| US10 | Receituário PDF | `GET /clinical-records/:id/prescription` | `tests/integration/routes/clinical.spec.ts` |
| US11 | Histórico Clínico | `GET /clinical-records/patient/:id` | `tests/integration/routes/clinical.spec.ts` |
| US12 | Exames Anexados | `POST /exams/upload`, `GET /exams/patient/:id` | `tests/integration/routes/exam.spec.ts` |
| US13 | Resumo por IA | `POST /clinical-records/:id/ai-summary` | `tests/integration/routes/clinical.spec.ts` |
| US14 | Dashboard do Tutor | `GET /portal/dashboard` | `tests/integration/routes/portal.spec.ts` |
| US15 | Alertas iougurt Care | `GET /portal/alerts` | `tests/integration/routes/portal.spec.ts` |
| US16 | Histórico Visão Tutor | `GET /portal/patients/:id/history` | `tests/integration/routes/portal.spec.ts` |

---

### Exemplos representativos (4 das 16 USes)

Cada bloco escolhe **uma técnica diferente** do PC2 para ilustrar — os outros specs seguem o mesmo padrão.

#### US05 — Cadastro Tutor (foco: **Utils + Parametrização**)

```typescript
// src/modules/tutor/infra/http/controllers/createTutorController.ts
cpf: z.string()
  .refine((val) => isValidCpf(val), { message: 'CPF inválido' })  // util compartilhado
  .transform((val) => onlyDigits(val)),
```

```typescript
// tests/integration/routes/tutor.spec.ts
it.each([
  { name: 'CPF inválido', body: { ...VALID_TUTOR_BODY, cpf: '00000000000' } },
  { name: 'sem fullName', body: { ...VALID_TUTOR_BODY, fullName: '' } },
  { name: 'phone curto', body: { ...VALID_TUTOR_BODY, phone: '11' } },
  { name: 'email inválido', body: { ...VALID_TUTOR_BODY, email: 'nope' } },
])('rejeita payload inválido ($name) com 422', async ({ body }) => {
  const response = await app.injectAuth({ method: 'POST', url: '/tutors', payload: body })
  expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
})
```

#### US07 — Criar Agendamento (foco: **Parametrização pelo enum**)

```typescript
// tests/integration/routes/appointment.spec.ts
it.each(APPOINTMENT.CATEGORIES)(    // 4 categorias em 1 caso
  'cria agendamento da categoria %s com 201',
  async (category) => {
    prismaMock.appointment.create.mockResolvedValue(Factory.appointment({ category }) as never)
    const response = await app.injectAuth({
      method: 'POST', url: '/appointments', payload: validBody(category),
    })
    expect(response.statusCode).toBe(HTTP.CREATED)
  },
)
```

#### US10 — Receituário PDF (foco: **Sem magic numbers**)

```typescript
// src/modules/clinical/useCases/generatePrescriptionUseCase.ts
const PAGE_WIDTH = 595.28
const MARGIN_X = 50
const TOP_BRAND_BAR_H = 18
const BOTTOM_BRAND_BAR_H = 18
const FOOTER_CONTENT_GAP = 6
```

```typescript
// tests/integration/routes/clinical.spec.ts
it('gera PDF quando prontuário está finalizado e possui prescrições', async () => {
  prismaMock.clinicalRecord.findUnique.mockResolvedValue({
    ...Factory.clinicalRecord({ finalized: true, prescriptions: 'Amoxicilina 250mg…' }),
    patient: { ...Factory.patient(), tutor: Factory.tutor(), clinic: Factory.clinic() },
    vet: Factory.owner(),
  } as never)

  const response = await app.injectAuth({
    method: 'GET', url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
  })

  expect(response.statusCode).toBe(HTTP.OK)
  expect(response.headers['content-type']).toContain('application/pdf')
})
```

#### US16 — Histórico do Pet (foco: **Guard de segurança + Integração**)

```typescript
// src/modules/portal/useCases/getTutorPatientHistoryUseCase.ts
const ownsPet = tutor.patients.some(p => p.id === patientId)
if (!ownsPet) throw new AppError('Você não tem permissão para acessar os dados deste animal.', 403)
```

```typescript
// tests/integration/routes/portal.spec.ts
it('rejeita pet que não pertence ao tutor com 403', async () => {
  prismaMock.user.findUnique.mockResolvedValue({
    ...Factory.tutorUser(),
    tutorAccount: { ...Factory.tutor(), patients: [] },   // sem pets
  } as never)
  const response = await app.injectAuth(
    { method: 'GET', url: `/portal/patients/${SEED.PATIENT_ID}/history` },
    { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
  )
  expect(response.statusCode).toBe(HTTP.FORBIDDEN)
})
```

---

## 10.1. Critérios PC2 × Onde estão no código

Mapa direto dos itens do quadro (PC2) para arquivos e linhas reais do repositório.

| Item do quadro | Onde está | Evidência |
|---|---|---|
| **CI/CD** | `.github/workflows/main.yml` | job `lint-e-testes` com service container Postgres, typecheck, `prisma migrate deploy`, `vitest run --coverage`, upload de artifact `coverage/`; job `build-docker` com cache GHA |
| **Clean Code** | `src/modules/*` | Clean Architecture: `IRepository` separado de `PrismaRepository`, useCases sem dependência de Fastify, factories isolam composição |
| **Testes Parametrizados** | `tests/integration/routes/*.spec.ts` | `it.each(APPOINTMENT.CATEGORIES)` em `appointment.spec.ts:25`; `it.each(['COMPLETED', 'CANCELLED', 'IN_PROGRESS'])` em `appointment.spec.ts:118`; `it.each([6, 91, -1])` em `dashboard.spec.ts:71` |
| **Integração (sobe o app)** | `tests/utils/app-builder.ts` | classe `TestApp` chama `app.ready()` e expõe `inject` / `injectAuth` |
| **Aponta para o Endpoint Container** | `.github/workflows/main.yml` + `docker-compose.yml` | CI tem `services.postgres: postgres:16-alpine` ; localmente `docker compose up` levanta `iougurt-db` + `iougurt-api` e os testes E2E batem em `http://localhost:3001` |
| **Evitar Repetições + OO** | `tests/utils/{app-builder,factories,constants}.ts` | classes `TestApp` e `Factory` reusadas em todos os 11 specs; constantes em objeto agrupado |
| **Utils** | `src/shared/documents.ts` (produção), `tests/utils/*` (teste) | `isValidCpf`, `isValidCnpj`, `onlyDigits` centralizados; `Factory.*`, `HTTP.*`, `ROLE.*` em utils de teste |
| **Números Mágicos NÃO** | `tests/utils/constants.ts` + `src/modules/clinical/useCases/generatePrescriptionUseCase.ts` | `HTTP.OK = 200`, `HTTP.CREATED = 201`, `SEED.PATIENT_ID`, `PAGE_WIDTH = 595.28`, `MARGIN_X = 50`, `TOP_BRAND_BAR_H = 18` |
| **docstring** | `src/modules/*/infra/http/*Routes.ts` | cada rota tem `schema: { summary: 'descrição', tags: [...], body: <ZodSchema> }` — vira documentação Swagger em `/docs` (ver exemplo abaixo) |
| **Comentários Reduzidos** | `tests/integration/routes/*.spec.ts` | testes sem comentários internos — nomes (`'rejeita payload inválido ($name) com 422'`) e constantes auto-explicam |
| **EMOJI NÃO** | `tests/`, `src/modules/*` | nenhum emoji nos testes/utils criados; ARCHITECTURE.md usa emojis só na tabela de checklist (status visual), não no código |
| **Laços de Repetição O(?)** | `src/modules/patient/infra/repositories/PrismaPatientsRepository.ts:53-56`, `src/modules/dashboard/infra/repositories/PrismaDashboardRepository.ts` | `Promise.all([findMany, count])` evita query sequencial; `groupBy` no banco em vez de loop no app |
| **Lint / Typecheck** | `package.json` + CI | `npm run typecheck` (TSC noEmit) roda antes dos testes no workflow |

### Como o item **"docstring"** aparece em rotas

Cada rota documenta a si mesma via schema do Fastify — vira a docstring que alimenta o Swagger em `/docs`:

```typescript
// src/modules/auth/infra/http/authRoutes.ts
app.post('/login', {
  schema: {
    tags: ['Auth'],
    summary: 'Autenticar com email e senha',
    body: authenticateBodySchema,
  },
}, authenticateController)

app.post('/register/vet', {
  preHandler: [verifyJwt, verifyRole('OWNER')],
  schema: {
    tags: ['Auth'],
    summary: 'Criar conta de Veterinário (apenas OWNER)',
    body: registerVetBodySchema,
    security: [{ bearerAuth: [] }],
  },
}, registerVetController)
```

### Anti-padrões do quadro que evitamos

A coluna direita da foto lista nomes ruins (`aux`, `A`, `j`, `afunda = 500`, `Quantidade funcionarios`). Confira que **nada disso aparece no nosso código de teste**:

- variáveis sempre com nome semântico (`response`, `payload`, `category`, `tutor`)
- nenhum literal numérico solto — toda comparação de status usa `HTTP.OK` / `HTTP.CREATED` / `HTTP.FORBIDDEN`
- nenhuma string mágica de status — usa `APPOINTMENT.STATUSES` e `ROLE.*`
- nenhum UUID hardcoded fora de `SEED.*`

---

## 10.2. Roteiro de Apresentação (PC2)

Sugestão de sequência para a banca, ~10 minutos.

### 1. Abertura (1min)
- Mostrar o app rodando: `docker compose up -d` → abrir `http://localhost:3001/docs` (Swagger). Cada rota tem `summary` (item **docstring** do quadro).

### 2. Modelo físico do banco (1min)
- Abrir `ARCHITECTURE.md` na seção **4 → Modelo físico (ER)** (diagrama Mermaid).
- Mostrar `prisma/schema.prisma` como a fonte de verdade.

### 3. Arquitetura — Clean Code (1min)
- `ARCHITECTURE.md` seção 3: explicar `useCase ↔ IRepository ↔ PrismaRepository`.
- Item **Clean Code** + **OO + Evitar Repetições**.

### 4. Testes de Integração (3min) — o coração do PC2
- Abrir `tests/utils/app-builder.ts` — classe `TestApp` é o "aponta para o endpoint container" do quadro.
- Abrir `tests/utils/constants.ts` — `HTTP`, `ROLE`, `SEED`. Item **Sem magic numbers**.
- Abrir `tests/integration/routes/appointment.spec.ts` linha 25 — `it.each(APPOINTMENT.CATEGORIES)`. Item **Testes parametrizados**.
- Mostrar `it.each(['COMPLETED', 'CANCELLED', 'IN_PROGRESS'])` linha 118 — outro exemplo.

### 5. Coverage (1min)
- Rodar `npm run test:coverage` ao vivo.
- Abrir `coverage/index.html` → mostrar 86%+ global e detalhar módulos `clinical/` e `auth/`.

### 6. CI/CD com container (2min)
- Abrir `.github/workflows/main.yml`.
- Mostrar `services.postgres` (item **container**), `prisma migrate deploy`, `npm run test:coverage`, upload do artifact.
- Job `build-docker` empilha a imagem.

### 7. Laços de Repetição O(?) (30s)
- Abrir `src/modules/patient/infra/repositories/PrismaPatientsRepository.ts:53` — `Promise.all([findMany, count])` em vez de duas queries sequenciais.

### 8. Encerramento (30s)
- Tabela 10.1 do `ARCHITECTURE.md` é o checklist final dos critérios.

### Comandos para ter colados na pasta
```bash
docker compose up -d --build   # sobe API + DB
docker compose logs -f api     # acompanha logs
npm test                       # 191 testes em segundos
npm run test:coverage          # gera relatório navegável
npm run test:routes            # só os de integração de rota
xdg-open coverage/index.html
```

---

## 11. Decisões de Design

### Por que Fastify e não Express?
Fastify é 2-3x mais rápido, tem suporte nativo a JSON Schema e integra perfeitamente com Zod via `fastify-type-provider-zod`, gerando tipagem TypeScript + validação + Swagger a partir da mesma definição Zod.

### Por que repositórios in-memory + Prisma mockado?
Para os **use cases**, repositórios in-memory permitem testar regras de negócio puras sem banco. Para os **testes de integração de rota**, mockamos o Prisma client com `vitest-mock-extended` — assim o app Fastify sobe inteiro, mas as queries são determinísticas. As 191 specs rodam em ~3 segundos.

### Por que Refresh Token no cookie?
Tokens no `localStorage` são vulneráveis a XSS. O cookie `HttpOnly` não é acessível via JavaScript. O access token (curta duração, 30min) fica no body da resposta.

### Por que senha temporária para o Tutor?
O veterinário cadastra o email do tutor e o sistema gera 12 caracteres aleatórios seguros (`randomBytes`). A senha é retornada **uma única vez** na resposta — não é persistida em texto claro.

### Por que Gemini 1.5 Flash?
É o modelo mais rápido e econômico do Google para geração de texto. A resposta é persistida em `ClinicalRecord.aiSummary` para não chamar a API repetidamente.
