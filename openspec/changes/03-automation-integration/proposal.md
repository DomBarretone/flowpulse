# Proposal: 03-automation-integration

## Objetivo

Implementar o **Fluxo 1** completo: cadastro de automações, geração de credenciais de integração com hash SHA-256, autenticação de sistemas externos via `x-api-key`, recebimento de execuções e criação automática de incidente `OPEN` quando as regras de detecção forem satisfeitas.

Este change entrega o pipeline de ingestão ponta a ponta e é o pré-requisito direto para o Fluxo 2 (change 04).

---

## Escopo

### Incluído

**Backend (apps/api) — ApiKeyGuard**
- `ApiKeyGuard`: guard NestJS que extrai o header `x-api-key`, computa o hash SHA-256 e busca correspondência na tabela `api_keys` (status `ACTIVE`)
- Retorna 401 se a chave for ausente, inválida ou revogada
- Injeta a `automation_id` correspondente no contexto da requisição para uso nos handlers

**Backend (apps/api) — AutomationsModule**
- Entidade `Automation` com schema Prisma: `id`, `name`, `description`, `source_type`, `criticality` (LOW/MEDIUM/HIGH), `expected_duration_seconds`, `default_owner_id`, `status` (DRAFT/ACTIVE/INACTIVE), `created_by`, `created_at`, `updated_at`
- Migration versionada para `automations`
- `POST /api/v1/automations` — cadastra automação em status `DRAFT` (requer ADMIN)
- `GET /api/v1/automations` — lista automações com paginação (ADMIN, ANALYST)
- `GET /api/v1/automations/{id}` — detalhe da automação (ADMIN, ANALYST)
- `POST /api/v1/automations/{id}/activate` — transita para `ACTIVE` após pelo menos um teste válido recebido (requer ADMIN)
- Registro de evento em `audit_logs` a cada criação e ativação

**Backend (apps/api) — ApiKeysModule**
- Entidade `ApiKey` com schema Prisma: `id`, `automation_id`, `key_prefix`, `key_hash` (SHA-256), `status` (ACTIVE/REVOKED), `created_at`, `revoked_at`
- Migration versionada para `api_keys`
- `POST /api/v1/automations/{id}/api-keys` — gera credencial: token aleatório com prefixo `fp_live_`, armazena apenas o hash SHA-256, retorna o token completo **uma única vez** (requer ADMIN)
- `DELETE /api/v1/automations/{id}/api-keys/{keyId}` — revogação da chave (requer ADMIN)
- Registro de evento em `audit_logs` a cada geração e revogação

**Backend (apps/api) — ExecutionsModule**
- Entidade `Execution` com schema Prisma: `id`, `automation_id`, `external_execution_id`, `status` (STARTED/SUCCESS/FAILED/TIMEOUT), `started_at`, `finished_at`, `duration_seconds`, `error_type`, `error_message`, `metadata` (JSON), `is_test`, `received_at`
- Migration versionada para `executions`
- `POST /api/v1/executions` — autenticado via `x-api-key` (ApiKeyGuard); valida corpo, persiste execução, aplica motor de regras (RN-03/RN-04) e retorna `execution_id` + `incident_id` (quando criado)
- `GET /api/v1/executions` — listagem com filtros por `automation_id`, `status`, período, `is_test` (ADMIN, ANALYST)

**Backend (apps/api) — Motor de Regras (RN-03 e RN-04)**
- Criação automática de incidente `OPEN` quando:
  - `status === FAILED` ou `status === TIMEOUT`
  - `duration_seconds > expected_duration_seconds` (da automação)
- Severidade calculada pela tabela RN-04:
  - Alta + falha/timeout → `CRITICAL`; Alta + duração → `HIGH`
  - Média + falha/timeout → `HIGH`; Média + duração → `MEDIUM`
  - Baixa + falha/timeout → `MEDIUM`; Baixa + duração → `LOW`
- Entidade `Incident` com schema Prisma mínimo: `id`, `automation_id`, `primary_execution_id`, `title`, `severity`, `status` (somente `OPEN` neste change), `error_fingerprint`, `created_at`, `updated_at`
- Entidade `IncidentEvent` para registro do evento de criação (`CREATED`)
- **Não implementar** transições de ciclo de vida (ACKNOWLEDGED, INVESTIGATING, RESOLVED) — change 04

**Frontend (apps/web)**
- Página `/automations` — listagem de automações com status, criticidade e ação de criar
- Página `/automations/new` — formulário de criação de automação
- Página `/automations/{id}` — detalhe com: dados da automação, botão de gerar credencial, exibição única da chave gerada, instrução de uso do endpoint de ingestão, botão de ativar monitoramento (após teste bem-sucedido)
- Página `/executions` — listagem de execuções com filtros básicos

### Excluído

- Transições de ciclo de vida do incidente (ACKNOWLEDGED, INVESTIGATING, RESOLVED) — change 04
- Análise de IA — change 04
- Dashboard e métricas MTTA/MTTR — change 05
- Agrupamento de incidentes por fingerprint (RN-07) — pode entrar neste change ou ser deferido; deve ser decidido na spec

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| Automation | `automations` | ✅ Schema + migration |
| ApiKey | `api_keys` | ✅ Schema + migration |
| Execution | `executions` | ✅ Schema + migration |
| Incident | `incidents` | ✅ Schema mínimo + migration (status OPEN apenas) |
| IncidentEvent | `incident_events` | ✅ Schema + migration (evento CREATED) |
| AuditLog | `audit_logs` | ✅ Schema + migration |

---

## Contratos de API

| Método | Rota | Auth | Papel | Descrição |
|--------|------|------|-------|-----------|
| `POST` | `/api/v1/automations` | Clerk JWT | ADMIN | Cadastra automação em DRAFT |
| `GET` | `/api/v1/automations` | Clerk JWT | ADMIN, ANALYST | Lista automações |
| `GET` | `/api/v1/automations/{id}` | Clerk JWT | ADMIN, ANALYST | Detalhe da automação |
| `POST` | `/api/v1/automations/{id}/api-keys` | Clerk JWT | ADMIN | Gera credencial (retorna token uma vez) |
| `DELETE` | `/api/v1/automations/{id}/api-keys/{keyId}` | Clerk JWT | ADMIN | Revoga credencial |
| `POST` | `/api/v1/automations/{id}/activate` | Clerk JWT | ADMIN | Ativa monitoramento |
| `POST` | `/api/v1/executions` | x-api-key | Sistema externo | Ingestão de execução |
| `GET` | `/api/v1/executions` | Clerk JWT | ADMIN, ANALYST | Lista execuções |

---

## Critério de Conclusão

```bash
npm run test          # testes unitários e de integração deste change passando
npm run typecheck     # sem erros
npm run lint          # sem erros
npm run build         # sem erros
```

**Testes unitários:**
- Motor de regras RN-04: todas as combinações criticidade × tipo de evento produzem a severidade correta
- Motor de regras RN-03: execução SUCCESS não gera incidente; FAILED, TIMEOUT e estouro de duração geram incidente OPEN
- `ApiKeyGuard`: hash correto autentica, hash incorreto rejeita com 401, chave revogada rejeita com 401
- Geração de API Key: token gerado tem prefixo `fp_live_`, banco armazena apenas hash SHA-256

**Testes de integração (Supertest):**
- `POST /api/v1/automations` sem ADMIN → 403
- `POST /api/v1/automations` com payload inválido → 422 RFC 7807
- `POST /api/v1/automations/{id}/api-keys` → 201 com token, banco contém apenas hash
- `POST /api/v1/executions` sem x-api-key → 401
- `POST /api/v1/executions` com status FAILED → 201, incidente OPEN criado, `incident_id` retornado
- `POST /api/v1/executions` com status SUCCESS → 201, `incident_id: null`
- `POST /api/v1/executions` com `is_test: true` → persiste execução de teste, não bloqueia ativação

---

## Não-objetivos

- Agrupamento de incidentes por fingerprint de erro (RN-07) — avaliar na spec
- Notificações externas (e-mail, mensageria) — versão 1.0
- Transições de estado do incidente além de OPEN

---

## Dependências

- `02-auth-rbac` (ClerkAuthGuard, RolesGuard, UsersModule ativos)

---

## Referências

- `@docs/spec.md` — Seções 3.1 (Fluxo 1), 4 (Regras de Negócio RN-01 a RN-04), 6 (Contratos de API)
- `@docs/architecture.md` — Chaves de Ingestão (API Keys), Visão de Componentes
- `@AGENTS.md` — Regras: hash SHA-256, audit_logs, nunca db push
