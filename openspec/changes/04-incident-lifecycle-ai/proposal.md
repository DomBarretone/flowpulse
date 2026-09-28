# Proposal: 04-incident-lifecycle-ai

## Objetivo

Formalizar e implementar integralmente o **Fluxo 2** do FlowPulse: o ciclo de vida completo de tratamento de incidentes operacionais a partir de uma ocorrência `OPEN` existente (gerada pela change 03), percorrendo assunção (`ACKNOWLEDGED`), investigação (`INVESTIGATING`), solicitação e retorno de diagnóstico estruturado via integração real com o **OpenRouter** (`AiAnalysis`), registro obrigatório de notas de solução e encerramento definitivo (`RESOLVED`).

A inteligência artificial nesta change é **estritamente consultiva**: apoia o diagnóstico do operador humano com hipóteses fundamentadas, sem jamais alterar status, assumir ou resolver incidentes, ou executar comandos em sistemas produtivos.

---

## Escopo

### Incluído

**1. Modelo de Dados & Persistência (Prisma ORM incremental)**
- Evolução da entidade `Incident` existente em `apps/api/prisma/schema.prisma` com adição de:
  - `assigned_to_id` (String nullable, FK para `users.id`);
  - `acknowledged_at` (DateTime nullable);
  - `investigating_at` (DateTime nullable);
  - `resolved_at` (DateTime nullable);
  - `resolution_notes` (String/Text nullable);
  - Preservação estrita dos campos existentes (`id`, `automation_id`, `execution_id`, `status`, `severity`, `opened_at`, `created_at`, `updated_at`).
- Criação da entidade `IncidentEvent` (`incident_events`) para histórico imutável:
  - `id` (UUID PK), `incident_id` (FK), `actor_user_id` (UUID nullable, FK), `event_type` (`IncidentEventType`), `from_status` (nullable), `to_status` (nullable), `note` (nullable), `created_at`.
- Criação da entidade `AiAnalysis` (`ai_analyses`):
  - `id` (UUID PK), `incident_id` (FK), `requested_by_id` (FK para `users.id`), `model` (String), `summary` (Text), `likely_causes` (Json), `evidence` (Json), `next_steps` (Json), `confidence` (Decimal/Float), `provider_request_id` (nullable), `latency_ms` (nullable), `created_at`.
- Migration versionada via `prisma migrate dev` sem perda de dados existentes da change 03.

**2. Máquina de Estados e Concorrência Atômica**
- Transições de estado estritamente lineares e permitidas:
  - `OPEN → ACKNOWLEDGED`
  - `ACKNOWLEDGED → INVESTIGATING`
  - `INVESTIGATING → RESOLVED`
- Proibição absoluta de:
  - Pular estados (`OPEN → INVESTIGATING`, `OPEN → RESOLVED`, `ACKNOWLEDGED → RESOLVED`);
  - Retroceder estados (`RESOLVED → OPEN`, `INVESTIGATING → ACKNOWLEDGED`);
  - Re-assumir incidente (`ACKNOWLEDGED → ACKNOWLEDGED`);
  - Transições após `RESOLVED` (imutável).
- Transições concorrentes protegidas deterministicamente no banco através de atomic update (`UPDATE ... WHERE id = ? AND status = expected_status`). Concorrência simultânea resulta em vitória de uma requisição e `409 Conflict` (RFC 7807) para a concorrente perdedora.

**3. Atribuição e Regras de Propriedade (Ownership & RBAC)**
- A transição `OPEN → ACKNOWLEDGED` constitui o ato de assunção do incidente ("claim"), preenchendo automaticamente `assigned_to_id = request.user.id` e `acknowledged_at = now()`. Não se aceita `assigned_to_id` arbitrário vindo do cliente.
- Papel `ANALYST`: pode assumir incidentes `OPEN`; uma vez atribuído, somente o próprio analista responsável pode investigar (`POST /investigate`), solicitar IA (`POST /ai-analysis`) e resolver (`POST /resolve`) o incidente. Tentativa de outro analista resulta em `403 Forbidden` (RFC 7807).
- Papel `ADMIN`: possui privilégios operacionais universais para visualizar, assumir, investigar, solicitar IA e resolver qualquer incidente.

**4. Endpoints RESTful de Incidentes (`/api/v1/incidents`)**
- `GET /api/v1/incidents` — listagem paginada com filtros por `status`, `severity`, `automation_id`, `assigned_to_id` (ADMIN e ANALYST);
- `GET /api/v1/incidents/:id` — detalhe completo do incidente, automação, execução primária, eventos e análises (ADMIN e ANALYST);
- `POST /api/v1/incidents/:id/acknowledge` — transição atômica `OPEN → ACKNOWLEDGED` atribuindo o usuário autenticado (ADMIN e ANALYST);
- `POST /api/v1/incidents/:id/investigate` — transição atômica `ACKNOWLEDGED → INVESTIGATING` com validação de ownership (ADMIN ou ANALYST atribuído);
- `POST /api/v1/incidents/:id/ai-analysis` — invocação da análise de IA em incidente em status `INVESTIGATING` com validação de ownership;
- `POST /api/v1/incidents/:id/resolve` — transição atômica `INVESTIGATING → RESOLVED` exigindo payload com `resolution_notes` não vazias;
- `GET /api/v1/incidents/:id/events` — consulta do histórico de eventos em ordem cronológica (ADMIN e ANALYST);
- `GET /api/v1/incidents/:id/ai-analyses` — consulta das análises de IA vinculadas ao incidente (ADMIN e ANALYST).

**5. Integração Real com OpenRouter (`apps/api`)**
- Integração server-side nativa (`fetch` com `AbortController`) direcionada a `POST https://openrouter.ai/api/v1/chat/completions`.
- Modelo configurável via ambiente: padrão `anthropic/claude-haiku-4.5`.
- Sanitização prévia e determinística de textos livres e logs (`error_message`): remoção/redação (`[REDACTED]`) de Bearer tokens, JWTs, chaves `fp_live_*`, credenciais `sk_*`, `pk_*`, emails, senhas e parâmetros sensíveis antes de qualquer envio externo.
- Structured Output com JSON Schema rigoroso:
  - `summary` (string concisa);
  - `likely_causes` (array de objetos `{ cause: string, rationale: string }`);
  - `evidence` (array de strings estritamente presentes no contexto fornecido);
  - `next_steps` (array de recomendações diagnósticas/operacionais para o humano);
  - `confidence` (número entre 0.0 e 1.0).
- Desacoplamento transacional: a chamada HTTP externa ao OpenRouter é realizada fora de transações de banco de dados.
- Resiliência operacional: timeouts (15s), indisponibilidade (`503`), erros `4xx`/`5xx` do provedor ou payloads malformados retornam `503 Service Unavailable` RFC 7807 tratado, sem jamais alterar o status do incidente ou bloquear o fluxo de investigação manual do operador.

**6. Frontend Next.js 15 (`apps/web`)**
- Navegação atualizada com acesso à fila de incidentes.
- Página `/incidents`: listagem de incidentes com badges de status e severidade, filtros contextuais e indicação de responsável.
- Página `/incidents/[id]`: visão aprofundada contendo:
  - Dados cadastrais do incidente, automação de origem e execução causadora com erro sanitizado;
  - Ações contextuais de transição: "Assumir Incidente" (`OPEN`), "Iniciar Investigação" (`ACKNOWLEDGED`), "Analisar com IA" e "Resolver Incidente" (`INVESTIGATING`);
  - Modal de resolução com validação de `resolution_notes` obrigatórias;
  - Painel de Análise Assistida por IA com identificador explícito de recomendação consultiva (texto + ícone, paleta escura, acessibilidade WCAG 2.1 AA) e exibição estruturada das hipóteses e próximos passos;
  - Linha do tempo visual cronológica com `IncidentEvent`.

---

### Excluído (Non-Goals)

- Dashboard de indicadores agregados e métricas computadas de MTTA e MTTR em lote — pertencem à change `05-dashboard-metrics`.
- Coleta de métricas e tracing via OpenTelemetry SDK distribuído e auditoria avançada unificada — pertencem à change `06-observability-quality`.
- Suíte E2E automatizada Playwright em navegadores reais para os Fluxos 1 e 2 — pertencem à change `06-observability-quality` (esta change cobre 100% de seus testes unitários em Jest e integração em Supertest).
- Orquestração produtiva Docker OCI multi-stage, infraestrutura Terraform e pipeline CI/CD GitHub Actions — pertencem à change `07-container-iac-deployment`.
- Ações autônomas, remediações automáticas ou mutações de estado no banco acionadas diretamente pelo modelo de IA.

---

## Entidades e Migrations

| Entidade | Tabela | Status neste change |
|---|---|---|
| `Incident` | `incidents` | **Evolução**: adição de `assigned_to_id`, `acknowledged_at`, `investigating_at`, `resolved_at`, `resolution_notes` |
| `IncidentEvent` | `incident_events` | **Nova**: criação da tabela para rastreamento imutável de eventos de ciclo de vida |
| `AiAnalysis` | `ai_analyses` | **Nova**: criação da tabela para persistência de análises diagnósticas estruturadas |
| `User` | `users` | **Evolução**: relação `assigned_incidents` apontando para `Incident` |

---

## Contratos de API REST (`/api/v1/incidents`)

| Método | Rota | Autenticação | Papel | Descrição |
|---|---|---|---|---|
| `GET` | `/api/v1/incidents` | Clerk JWT | ADMIN, ANALYST | Lista incidentes com filtros e paginação |
| `GET` | `/api/v1/incidents/:id` | Clerk JWT | ADMIN, ANALYST | Detalhe completo do incidente |
| `POST` | `/api/v1/incidents/:id/acknowledge` | Clerk JWT | ADMIN, ANALYST | Assume incidente e transita para ACKNOWLEDGED |
| `POST` | `/api/v1/incidents/:id/investigate` | Clerk JWT | ADMIN, ANALYST (ownership) | Transita para INVESTIGATING |
| `POST` | `/api/v1/incidents/:id/ai-analysis` | Clerk JWT | ADMIN, ANALYST (ownership) | Dispara análise diagnóstica com OpenRouter |
| `POST` | `/api/v1/incidents/:id/resolve` | Clerk JWT | ADMIN, ANALYST (ownership) | Finaliza incidente com resolution_notes |
| `GET` | `/api/v1/incidents/:id/events` | Clerk JWT | ADMIN, ANALYST | Lista timeline de eventos do incidente |
| `GET` | `/api/v1/incidents/:id/ai-analyses` | Clerk JWT | ADMIN, ANALYST | Lista análises de IA persistidas |

---

## Critério de Conclusão

A change só poderá ser aceita se todos os seguintes comandos terminarem com código de saída 0:
```bash
npm run db:generate
npm run db:migrate
npm run lint
npm run typecheck
npm run test
npm run build
docker compose config
```

Coberturas de testes obrigatórias:
- **Unitários (`apps/api` via Jest):**
  - Validador da máquina de estados (rejeição de saltos, retrocessos e reaberturas com 409);
  - Concorrência atômica de transições;
  - Regra de ownership RBAC (ANALYST vs ADMIN);
  - Validação de obrigatoriedade e não-vacuidade de `resolution_notes`;
  - Sanitizador de dados sensíveis (remoção de Bearer, JWT, `fp_live_*`, `sk_*`, emails, senhas);
  - Serviço OpenRouter com mocks completos: sucesso 200 com structured output, timeout via AbortController, erros 401/403/429/5xx, body vazio, schema inválido; garantia de que API key nunca vaza em logs/erros.
- **Integração (`apps/api` via Supertest):**
  - Fluxo ponta a ponta: `OPEN` -> `acknowledge` -> `investigate` -> `ai-analysis` -> `resolve` -> `RESOLVED`;
  - Rejeição de transições concorrentes (409 Conflict);
  - Rejeição de analista operando incidente alheio (403 Forbidden);
  - Falha da IA mantendo incidente em `INVESTIGATING` e retornando 503 RFC 7807;
  - Linha do tempo de `IncidentEvent` em ordem cronológica.
- **Frontend (`apps/web` via Jest/React Testing Library):**
  - Listagem de incidentes, badges, filtros e empty states;
  - Detalhe de incidente e habilitação condicional de botões por papel e status;
  - Modal de resolução com bloqueio de envio sem notas;
  - Renderização da análise de IA estruturada e aviso consultivo explícito;
  - Tratamento de loading e erro 503 sem corrupção de estado local.
