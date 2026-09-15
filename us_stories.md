# IOUGURT — Histórias de Usuário Implementadas

Este documento registra as histórias complementares entregues após as US01–US16.
As rotas, regras de acesso e cenários abaixo refletem a implementação atual da API.

## US17 — Carteira de vacinação do paciente

Como profissional da clínica, quero registrar e consultar as vacinas de um paciente,
para acompanhar sua situação vacinal durante o atendimento.

### Critérios de aceite

- Usuários autenticados podem registrar uma vacina em `POST /vaccinations`.
- A carteira de um paciente é consultada em `GET /vaccinations/patient/:patientId`.
- O status de uma vacina pode ser atualizado em `PATCH /vaccinations/:id/status`.
- As três operações exigem JWT válido e são cobertas por `tests/integration/routes/vaccination.spec.ts`.

## US18 — Login com Google

Como usuário da clínica, quero entrar com minha conta Google,
para reduzir o atrito de autenticação sem compartilhar minha senha com a aplicação.

### Critérios de aceite

- O endpoint `POST /auth/google` recebe e valida o token de identidade do Google.
- O usuário é localizado ou criado a partir da identidade validada.
- A resposta segue o fluxo de sessão da API, com tokens de acesso e renovação.
- Os fluxos de sucesso e validação são verificados em `tests/integration/routes/auth.spec.ts`.

## US19 — Gestão do perfil da clínica

Como dono da clínica, quero consultar e atualizar os dados cadastrais da minha clínica,
para manter as informações administrativas corretas.

### Critérios de aceite

- Qualquer usuário autenticado da clínica pode consultar os dados em `GET /clinics/me`.
- Somente usuários com a role `OWNER` podem atualizar os dados em `PATCH /clinics/me`.
- O CNPJ é validado e normalizado antes da persistência.
- Os controles de autenticação, autorização e validação são cobertos por `tests/integration/routes/clinic.spec.ts`.

## US20 — Recuperação segura de senha

Como usuário que perdeu a senha, quero solicitar um link de recuperação e definir uma nova senha,
para recuperar o acesso à minha conta com segurança.

### Critérios de aceite

- A solicitação é feita em `POST /auth/password/forgot` sem revelar se o e-mail existe.
- A redefinição é feita em `POST /auth/password/reset` com token válido e não expirado.
- Ambos os endpoints têm limite de três tentativas a cada 15 minutos.
- O token é validado antes da troca da senha e os cenários são cobertos por `tests/integration/routes/auth.spec.ts`.

## Rastreabilidade

| História | Rotas | Módulo |
|---|---|---|
| US17 | `/vaccinations` | `clinical` |
| US18 | `/auth/google` | `auth` |
| US19 | `/clinics/me` | `clinic` |
| US20 | `/auth/password/forgot`, `/auth/password/reset` | `auth` |
