---
trigger: always_on
---

# Arquitetura do Projeto IOUGURT (Bíblia)

Este documento define a arquitetura e os padrões de desenvolvimento do IOUGURT.
**Source of Truth** para arquitetura, setup de banco de dados e regras de negócio.

> Este documento foi inspirado no padrão do projeto Fly, adaptado ao domínio veterinário.

---

## 🔧 Setup & Migrations (Crítico)

O IOUGURT utiliza **Docker** para todo o ambiente. O banco de dados (PostgreSQL) e o código da API compartilham volumes com o host para facilitar o desenvolvimento com hot-reload.

### Subindo o projeto

```bash
# Na pasta raiz (onde está o docker-compose.yml)
docker compose up
```

O container da API já executa `prisma migrate deploy` automaticamente no boot.

### Criando migrations após alterar o schema

```bash
docker compose exec api npx prisma migrate dev --name descricao_da_mudanca
```

Este comando:

1. Compara o `schema.prisma` com o banco atual
2. Gera arquivos SQL em `prisma/migrations/` (sincronizado via volume no host)
3. Aplica as mudanças no PostgreSQL
4. Regenera o Prisma Client

**Se houver problemas de permissão no diretório `prisma/`:**

```bash
chmod -R 777 prisma/
```

---

## 🏗️ Visão Geral da Stack

| Camada             | Tecnologia                                |
| ------------------ | ----------------------------------------- |
| **API**            | Fastify (REST) — porta 3000               |
| **Banco de Dados** | PostgreSQL 16 (**source of truth**)       |
| **ORM**            | Prisma (isolado na camada de Infra)       |
| **Auth**           | JWT (AccessToken 15m) + RefreshToken (7d) |
| **Linguagem**      | TypeScript (strict mode)                  |
| **Runtime Dev**    | tsx (hot-reload)                          |
| **Build**          | tsup                                      |

---

## 📦 Módulos do Sistema

O projeto segue **Clean Architecture** com **Modular Factories**.

### ✅ Épico 1: Auth (`modules/auth`) — US01

- Login com e-mail e senha
- Tokens JWT: AccessToken (15min) + RefreshToken (7d) com rotação
- **Models**: `User`, `RefreshToken`

### 🚧 Épico 2: Dashboard (`modules/dashboard`) — US02, US03

- Painel inicial com últimos atendimentos e agenda do dia
- Dashboard restrito para ADMIN com gráfico de atendimentos
- **Depende de**: `clinical`, `schedule`

### 🚧 Épico 3: Pacientes e Tutores (`modules/patient`, `modules/tutor`) — US04, US05

- CRUD de pacientes com foto, espécie, raça, microchip, alergias
- Tutor vinculado obrigatoriamente ao paciente (CPF, contato, convênio)
- Alerta ao sair com alterações não salvas
- **Models**: `Patient`, `Tutor`

### 🚧 Épico 4: Agenda (`modules/schedule`) — US06, US07, US08

- Visualização em grade por dia
- Criação com tutor, paciente, veterinário, categoria e data
- Cancelamento com justificativa obrigatória
- **Models**: `Appointment` (enum: `VACCINATION`, `OBSERVATION`, `EXAM`, `SURGICAL`)

### 🚧 Épico 5: Prontuário e Atendimento Clínico (`modules/clinical`) — US09–13

- Registro de notas clínicas, diagnóstico, receita e orientações
- Histórico unificado com abas: Atendimentos, Vacinas, Curva de Peso
- Emissão de receita em PDF
- Upload de exames (PDF/imagem) vinculados à consulta
- Resumo gerado por IA (US13)
- **Models**: `ClinicalRecord`, `Vaccination`, `ExamFile`

### 🚧 Épico 6: Portal do Tutor (`modules/portal`) — US14–16

- Acesso via `role: TUTOR` no `User`
- Visão restrita ao próprio pet
- Alertas de vacinas pendentes
- Leitura do histórico clínico sem edição
- **Models**: reusa `Patient`, `ClinicalRecord`, `Vaccination` com filtros de permissão

### 🚧 Épico 7: Orçamentos (`modules/budget`) — EVO-01

- Rotas aninhadas em `/clinics/:clinicId/budgets` (`OWNER` e `VET`); o `clinicId` da URL precisa ser o do token
- Totais calculados só no backend (2 casas); `APPROVED` bloqueia qualquer alteração de status
- **Models**: `Budget`, `BudgetItem` (enum `BudgetStatus`), ligados a `Clinic`, `Patient` e `Tutor`

---

## 🎯 Princípios Core

1. **Dependency Rule**: Use Cases **não dependem** de framework ou banco de dados (infra).
2. **Modular Factories**: A composição (injeção de dependências) ocorre em `factories/` por módulo.
3. **Database Isolation**: `PrismaClient` **nunca é importado** diretamente em Use Cases.
4. **Separação de Roles**: ADMIN, VET, ATTENDANT e TUTOR têm acessos distintos por middleware.

---

## 📏 Padrões de Implementação ("One File Per Thing")

Para manter o código organizado e navegável, seguimos a regra de **um arquivo por componente**:

### Controllers

```
❌ controllers.ts          (vários controllers no mesmo arquivo)
✅ createPatientController.ts
✅ listPatientsController.ts
```

### Use Cases

```
❌ useCases.ts             (vários use cases no mesmo arquivo)
✅ createPatientUseCase.ts
✅ listPatientsUseCase.ts
```

### Factories

```
❌ factories/index.ts      (com lógica inline)
✅ makeCreatePatientUseCase.ts
✅ makeListPatientsUseCase.ts
```

---

## 💾 Schema de Referência

O `prisma/schema.prisma` é a fonte da verdade. Resumo estrutural:

```sql
-- Auth (US01)
users            (id, email, password_hash, name, avatar_url, role, ...)
refresh_tokens   (id, token, user_id, expires_at, ...)

-- Épico 3: Pacientes e Tutores (US04, US05)
tutors           (id, user_id?, full_name, cpf, phone, email, address, insurance, ...)
patients         (id, name, photo_url, birth_date, microchip, allergies, species, breed, tutor_id, ...)

-- Épico 4: Agenda (US06, US07, US08)
appointments     (id, patient_id, vet_id, date_time, category, status, observation, cancel_reason, ...)

-- Épico 5: Prontuário (US09-13)
clinical_records (id, patient_id, vet_id, appointment_id?, weight_kg, clinical_notes,
                  diagnosis, pending_diagnosis, prescriptions, breathing_notes,
                  routine_guidance, ai_summary, finalized, ...)

vaccinations     (id, patient_id, vaccine_name, applied_at, next_dose_at, status, ...)
exam_files       (id, patient_id, clinical_record_id?, file_name, file_url, file_type, ...)

-- Épico 7: Orçamentos (EVO-01)
budgets          (id, clinic_id, patient_id, tutor_id, status, discount, total_amount, notes?, valid_until?, ...)
budget_items     (id, budget_id, description, quantity, unit_price, subtotal)  -- ON DELETE CASCADE
```

### Decisões de Design

| Decisão                                            | Justificativa                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `weight_kg` em `ClinicalRecord` (não em `Patient`) | Peso é variável e medido por consulta — a "curva de peso" (US11) é derivada do histórico de `ClinicalRecord` |
| `Vaccination` como tabela separada                 | Tem ciclo de vida próprio: `status`, `next_dose_at`, existe independente de consulta                         |
| `ExamFile.clinical_record_id` opcional             | Exame pode ser vinculado a consulta específica (US12), mas também pode ser upload avulso                     |
| `Tutor.user_id` opcional                           | Tutor só tem `User` se for cadastrado no Portal (US14); cadastro pela clínica não exige login                |
| `Role` enum em `User`                              | RBAC simples: ADMIN, VET, ATTENDANT, TUTOR — sem multi-tenant                                                |

---

## 🧠 Arquitetura de Pastas

```text
src/modules/{module_name}/
├── repositories/              # 📋 Contratos (Interfaces TypeScript)
├── useCases/                  # 🔧 Regras de Negócio
│   └── factories/             # 🏭 Composição/Injeção de Dependências
└── infra/                     # 🚀 Implementações de Infraestrutura
    ├── repositories/          # Implementações Prisma dos contratos
    └── http/                  # Controllers e definição de rotas Fastify
```

### Exemplo de fluxo completo (criação de paciente)

```
POST /patients
    └── patientRoutes.ts           (infra/http)
         └── createPatientController.ts (infra/http)
              └── makeCreatePatientUseCase.ts (useCases/factories)
                   └── CreatePatientUseCase.ts (useCases)
                        └── IPatientsRepository (repositories — interface)
                             └── PrismaPatientsRepository.ts (infra/repositories)
                                  └── prisma.patient.create(...)
```

---

## 🔄 Fluxos Principais (Planejados)

### Fluxo A: Atendimento Clínico

```
Agendamento (SCHEDULED)
  → Início do atendimento (IN_PROGRESS)
  → Preenchimento do ClinicalRecord pelo veterinário
  → Finalização (finalized = true)
  → Geração de receita PDF (US10)
  → Geração de resumo por IA (US13)
  → Status: COMPLETED
```

### Fluxo B: Portal do Tutor

````---
trigger: always_on
---

# Arquitetura do Projeto IOUGURT (Bíblia)

Este documento define a arquitetura e os padrões de desenvolvimento do IOUGURT.
**Source of Truth** para arquitetura, setup de banco de dados e regras de negócio.

> Este documento foi inspirado no padrão do projeto Fly, adaptado ao domínio veterinário.

---

## 🔧 Setup & Migrations (Crítico)

O IOUGURT utiliza **Docker** para todo o ambiente. O banco de dados (PostgreSQL) e o código da API compartilham volumes com o host para facilitar o desenvolvimento com hot-reload.

### Subindo o projeto

```bash
# Na pasta raiz (onde está o docker-compose.yml)
docker compose up
````

O container da API já executa `prisma migrate deploy` automaticamente no boot.

### Criando migrations após alterar o schema

```bash
docker compose exec api npx prisma migrate dev --name descricao_da_mudanca
```

Este comando:

1. Compara o `schema.prisma` com o banco atual
2. Gera arquivos SQL em `prisma/migrations/` (sincronizado via volume no host)
3. Aplica as mudanças no PostgreSQL
4. Regenera o Prisma Client

**Se houver problemas de permissão no diretório `prisma/`:**

```bash
chmod -R 777 prisma/
```

---

## 🏗️ Visão Geral da Stack

| Camada             | Tecnologia                                |
| ------------------ | ----------------------------------------- |
| **API**            | Fastify (REST) — porta 3000               |
| **Banco de Dados** | PostgreSQL 16 (**source of truth**)       |
| **ORM**            | Prisma (isolado na camada de Infra)       |
| **Auth**           | JWT (AccessToken 15m) + RefreshToken (7d) |
| **Linguagem**      | TypeScript (strict mode)                  |
| **Runtime Dev**    | tsx (hot-reload)                          |
| **Build**          | tsup                                      |

---

## 📦 Módulos do Sistema

O projeto segue **Clean Architecture** com **Modular Factories**.

### ✅ Épico 1: Auth (`modules/auth`) — US01

- Login com e-mail e senha
- Tokens JWT: AccessToken (15min) + RefreshToken (7d) com rotação
- **Models**: `User`, `RefreshToken`

### 🚧 Épico 2: Dashboard (`modules/dashboard`) — US02, US03

- Painel inicial com últimos atendimentos e agenda do dia
- Dashboard restrito para ADMIN com gráfico de atendimentos
- **Depende de**: `clinical`, `schedule`

### 🚧 Épico 3: Pacientes e Tutores (`modules/patient`, `modules/tutor`) — US04, US05

- CRUD de pacientes com foto, espécie, raça, microchip, alergias
- Tutor vinculado obrigatoriamente ao paciente (CPF, contato, convênio)
- Alerta ao sair com alterações não salvas
- **Models**: `Patient`, `Tutor`

### 🚧 Épico 4: Agenda (`modules/schedule`) — US06, US07, US08

- Visualização em grade por dia
- Criação com tutor, paciente, veterinário, categoria e data
- Cancelamento com justificativa obrigatória
- **Models**: `Appointment` (enum: `VACCINATION`, `OBSERVATION`, `EXAM`, `SURGICAL`)

### 🚧 Épico 5: Prontuário e Atendimento Clínico (`modules/clinical`) — US09–13

- Registro de notas clínicas, diagnóstico, receita e orientações
- Histórico unificado com abas: Atendimentos, Vacinas, Curva de Peso
- Emissão de receita em PDF
- Upload de exames (PDF/imagem) vinculados à consulta
- Resumo gerado por IA (US13)
- **Models**: `ClinicalRecord`, `Vaccination`, `ExamFile`

### 🚧 Épico 6: Portal do Tutor (`modules/portal`) — US14–16

- Acesso via `role: TUTOR` no `User`
- Visão restrita ao próprio pet
- Alertas de vacinas pendentes
- Leitura do histórico clínico sem edição
- **Models**: reusa `Patient`, `ClinicalRecord`, `Vaccination` com filtros de permissão

---

## 🎯 Princípios Core

1. **Dependency Rule**: Use Cases **não dependem** de framework ou banco de dados (infra).
2. **Modular Factories**: A composição (injeção de dependências) ocorre em `factories/` por módulo.
3. **Database Isolation**: `PrismaClient` **nunca é importado** diretamente em Use Cases.
4. **Separação de Roles**: ADMIN, VET, ATTENDANT e TUTOR têm acessos distintos por middleware.

---

## 📏 Padrões de Implementação ("One File Per Thing")

Para manter o código organizado e navegável, seguimos a regra de **um arquivo por componente**:

### Controllers

```
❌ controllers.ts          (vários controllers no mesmo arquivo)
✅ createPatientController.ts
✅ listPatientsController.ts
```

### Use Cases

```
❌ useCases.ts             (vários use cases no mesmo arquivo)
✅ createPatientUseCase.ts
✅ listPatientsUseCase.ts
```

### Factories

```
❌ factories/index.ts      (com lógica inline)
✅ makeCreatePatientUseCase.ts
✅ makeListPatientsUseCase.ts
```

---

## 💾 Schema de Referência

O `prisma/schema.prisma` é a fonte da verdade. Resumo estrutural:

```sql
-- Auth (US01)
users            (id, email, password_hash, name, avatar_url, role, ...)
refresh_tokens   (id, token, user_id, expires_at, ...)

-- Épico 3: Pacientes e Tutores (US04, US05)
tutors           (id, user_id?, full_name, cpf, phone, email, address, insurance, ...)
patients         (id, name, photo_url, birth_date, microchip, allergies, species, breed, tutor_id, ...)

-- Épico 4: Agenda (US06, US07, US08)
appointments     (id, patient_id, vet_id, date_time, category, status, observation, cancel_reason, ...)

-- Épico 5: Prontuário (US09-13)
clinical_records (id, patient_id, vet_id, appointment_id?, weight_kg, clinical_notes,
                  diagnosis, pending_diagnosis, prescriptions, breathing_notes,
                  routine_guidance, ai_summary, finalized, ...)

vaccinations     (id, patient_id, vaccine_name, applied_at, next_dose_at, status, ...)
exam_files       (id, patient_id, clinical_record_id?, file_name, file_url, file_type, ...)
```

### Decisões de Design

| Decisão                                            | Justificativa                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `weight_kg` em `ClinicalRecord` (não em `Patient`) | Peso é variável e medido por consulta — a "curva de peso" (US11) é derivada do histórico de `ClinicalRecord` |
| `Vaccination` como tabela separada                 | Tem ciclo de vida próprio: `status`, `next_dose_at`, existe independente de consulta                         |
| `ExamFile.clinical_record_id` opcional             | Exame pode ser vinculado a consulta específica (US12), mas também pode ser upload avulso                     |
| `Tutor.user_id` opcional                           | Tutor só tem `User` se for cadastrado no Portal (US14); cadastro pela clínica não exige login                |
| `Role` enum em `User`                              | RBAC simples: ADMIN, VET, ATTENDANT, TUTOR — sem multi-tenant                                                |

---

## 🧠 Arquitetura de Pastas

```text
src/modules/{module_name}/
├── repositories/              # 📋 Contratos (Interfaces TypeScript)
├── useCases/                  # 🔧 Regras de Negócio
│   └── factories/             # 🏭 Composição/Injeção de Dependências
└── infra/                     # 🚀 Implementações de Infraestrutura
    ├── repositories/          # Implementações Prisma dos contratos
    └── http/                  # Controllers e definição de rotas Fastify
```

### Exemplo de fluxo completo (criação de paciente)

```
POST /patients
    └── patientRoutes.ts           (infra/http)
         └── createPatientController.ts (infra/http)
              └── makeCreatePatientUseCase.ts (useCases/factories)
                   └── CreatePatientUseCase.ts (useCases)
                        └── IPatientsRepository (repositories — interface)
                             └── PrismaPatientsRepository.ts (infra/repositories)
                                  └── prisma.patient.create(...)
```

---

## 🔄 Fluxos Principais (Planejados)

### Fluxo A: Atendimento Clínico

```
Agendamento (SCHEDULED)
  → Início do atendimento (IN_PROGRESS)
  → Preenchimento do ClinicalRecord pelo veterinário
  → Finalização (finalized = true)
  → Geração de receita PDF (US10)
  → Geração de resumo por IA (US13)
  → Status: COMPLETED
```

### Fluxo B: Portal do Tutor

```
Tutor recebe credenciais (role: TUTOR, user_id no Tutor)
  → Login → JWT com role TUTOR
  → Acesso restrito a /portal/* (middleware verifica role)
  → Visualiza apenas pacientes atrelados ao seu Tutor
  → Leitura do histórico + alertas de vacinação pendente
```

---

## 🗺️ Priorização (ICE Score — do mvp.md)

| MVP       | User Stories                       | Período      |
| --------- | ---------------------------------- | ------------ |
| **MVP 1** | US01, US05, US06, US04, US07       | Semanas 1–4  |
| **MVP 2** | US09, US11, US10, US02, US03, US12 | Semanas 5–8  |
| **MVP 3** | US14, US08, US16, US15, US13       | Semanas 9–12 |

Tutor recebe credenciais (role: TUTOR, user_id no Tutor)
→ Login → JWT com role TUTOR
→ Acesso restrito a /portal/\* (middleware verifica role)
→ Visualiza apenas pacientes atrelados ao seu Tutor
→ Leitura do histórico + alertas de vacinação pendente

```

---

## 🗺️ Priorização (ICE Score — do mvp.md)

| MVP       | User Stories                       | Período      |
| --------- | ---------------------------------- | ------------ |
| **MVP 1** | US01, US05, US06, US04, US07       | Semanas 1–4  |
| **MVP 2** | US09, US11, US10, US02, US03, US12 | Semanas 5–8  |
| **MVP 3** | US14, US08, US16, US15, US13       | Semanas 9–12 |
```
