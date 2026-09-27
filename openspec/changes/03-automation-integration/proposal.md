# Proposal: 03-automation-integration

## 1. Visão Geral e Objetivo

Formalizar a implementação completa do **Fluxo 1 (Integração e Monitoramento de Automações)** do FlowPulse e estabelecer a fronteira arquitetural para o **Fluxo 2 (Tratamento de Incidentes)**.

Permitir que um usuário com papel `ADMIN` autenticado via Clerk:
1. Cadastre uma nova automação configurando parâmetros operacionais (criticidade e duração esperada);
2. Gere credenciais de máquina dedicadas (`ApiKey`) criptograficamente seguras com prefixo `fp_live_`;
3. Visualize o segredo da chave de integração **uma única vez** no momento de sua emissão;
4. Envie um evento de teste real através do endpoint REST `/api/v1/executions` autenticado via cabeçalho `x-api-key`;
5. Tenha a execução de teste persistida confiavelmente no PostgreSQL via Prisma;
6. Veja o estado de integração da automação transitar de `PENDING` para `VALIDATED`;
7. Ative o monitoramento produtivo da automação (bloqueado enquanto `integration_status != VALIDATED`);
8. Consulte o histórico de execuções recebidas.

Adicionalmente, define a fronteira imediata para o Fluxo 2:
- Quando uma execução real (`is_test: false`) com status `FAILED` for recebida para uma automação ativa (`status: ACTIVE`), o backend cria automaticamente um registro de `Incident` com status inicial `OPEN` e severidade calculada deterministicamente a partir da criticidade da automação.
- O reenvio idempotente da mesma execução ou execuções de teste (`is_test: true`) nunca produzem incidentes duplicados.
- Toda a gestão subsequente do ciclo de vida de incidentes (acknowledge, investigate, resolve, IA, OpenRouter, MTTA, MTTR) fica explicitamente delimitada para a change 04.

---

## 2. Escopo Detalhado

### 2.1 Backend (`apps/api`)

#### Modelo de Dados e Persistência (Prisma ORM & PostgreSQL)
- **Entidade `Automation` (`automations`):**
  - Campos: `id` (UUID), `name`, `description` (opcional), `owner_id` (FK -> `User.id`), `criticality` (Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `expected_duration_seconds` (inteiro positivo), `status` (Enum: `DRAFT`, `ACTIVE`, `INACTIVE`), `integration_status` (Enum: `PENDING`, `VALIDATED`, `FAILED`), `created_at`, `updated_at`.
  - Regras: inicia em `status: DRAFT` e `integration_status: PENDING`. Ativação estritamente bloqueada se `integration_status != VALIDATED`.
- **Entidade `ApiKey` (`api_keys`):**
  - Campos: `id` (UUID), `automation_id` (FK -> `Automation.id`), `key_hash` (hash SHA-256 do token completo), `prefix` (prefixo público para identificação, e.g. `fp_live_...`), `created_at`, `revoked_at` (opcional), `last_used_at` (opcional).
  - Regras: o token bruto gerado nunca é persistido; lookup é realizado exclusivamente por SHA-256 determinístico.
- **Entidade `Execution` (`executions`):**
  - Campos: `id` (UUID), `automation_id` (FK -> `Automation.id`), `external_execution_id` (identificador no sistema externo), `status` (Enum: `RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`), `started_at`, `finished_at` (opcional), `duration_ms` (opcional), `error_message` (opcional), `is_test` (boolean, default false), `created_at`.
  - Unicidade e Idempotência: restrição única composta `@@unique([automation_id, external_execution_id])`.
- **Entidade Mínima `Incident` (`incidents`):**
  - Campos: `id` (UUID), `automation_id` (FK -> `Automation.id`), `execution_id` (FK -> `Execution.id`, Unique), `status` (Enum: `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED` — com aplicação produzindo estritamente `OPEN`), `severity` (Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `opened_at`, `created_at`, `updated_at`.
- **Migrations Versionadas:**
  - Aplicação de migrations incrementais via `prisma migrate dev`. Proibição estrita de `prisma db push`.

#### Autenticação & Autorização
- **`ApiKeyGuard`:**
  - Guard NestJS desacoplado do `ClerkAuthGuard`, atuando exclusivamente em endpoints de ingestão de máquina (`/api/v1/executions`).
  - Extrai o cabeçalho `x-api-key`, valida o formato (`fp_live_...`), calcula o hash SHA-256, consulta a chave ativa no banco, verifica se não está revogada e vincula a `automation_id` ao contexto da requisição (`request.automation`). Atualiza `last_used_at` de forma assíncrona/transacional.
  - Chaves ausentes, com formato corrompido, inexistentes ou revogadas retornam `401 Unauthorized` estruturado em RFC 7807 com `request_id`.
- **`ClerkAuthGuard` + `RolesGuard`:**
  - Aplicados em todas as rotas de gerenciamento de automações (`/api/v1/automations`).
  - `ADMIN`: criação, edição, geração de chave, revogação de chave, ativação e desativação.
  - `ANALYST`: leitura de automações e consulta de execuções.

#### Endpoints REST (`/api/v1`)
- `POST /api/v1/automations`: cadastro de automação em `DRAFT` / `PENDING` (ADMIN).
- `GET /api/v1/automations`: listagem paginada e filtrada de automações (ADMIN, ANALYST).
- `GET /api/v1/automations/:id`: detalhe da automação com status de integração (ADMIN, ANALYST).
- `PATCH /api/v1/automations/:id`: atualização cadastral de criticidade, nome, descrição e duração (ADMIN).
- `POST /api/v1/automations/:id/api-keys`: geração de nova credencial; retorna o segredo puro uma única vez (ADMIN).
- `POST /api/v1/automations/:id/api-keys/:keyId/revoke`: revogação imediata de credencial (ADMIN).
- `POST /api/v1/automations/:id/activate`: ativação da automação (bloqueada se `integration_status != VALIDATED`) (ADMIN).
- `POST /api/v1/automations/:id/deactivate`: transição para `INACTIVE` (ADMIN).
- `POST /api/v1/executions`: ingestão de execução externa autenticada via `x-api-key` (Sistema externo via ApiKeyGuard). Não aceita `automation_id` no payload. Trata reenvios de forma idempotente. Se `is_test: true`, atualiza `integration_status` para `VALIDATED` sem criar incidente. Se `is_test: false` e `status: FAILED` em automação `ACTIVE`, cria `Incident` em `OPEN`.
- `GET /api/v1/executions`: consulta de histórico de execuções com filtros por automação, status e flag de teste (ADMIN, ANALYST).

### 2.2 Frontend (`apps/web`)

- **Listagem de Automações (`/automations`):**
  - Tabela responsiva com status operacional (`DRAFT`, `ACTIVE`, `INACTIVE`), criticidade, status de integração (`PENDING`, `VALIDATED`, `FAILED`) e ações contextuais.
- **Formulário de Criação (`/automations/new`):**
  - Cadastro com validação de nome, descrição, criticidade (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) e duração esperada em segundos.
- **Detalhes da Automação (`/automations/[id]`):**
  - Informações cadastrais e operacionais.
  - Seção de Credenciais de Integração: botão para gerar nova API key (ADMIN), modal/alerta com aviso explícito de visualização única, exibição do segredo `fp_live_...` com botão de copiar seguro, e tabela de chaves ativas/revogadas exibindo apenas prefixo e data.
  - Guia de Teste de Integração: snippet cURL seguro com instruções de envio de evento de teste (`is_test: true`) usando a API key recém-gerada.
  - Indicador de status de integração (`PENDING`, `VALIDATED`, `FAILED`) combinando cor, texto e ícone (WCAG 2.1 AA).
  - Botão de ativação de monitoramento: desabilitado com tooltip explicativo enquanto `integration_status != VALIDATED`, habilitado dinamicamente após validação.
  - Tabela de execuções recentes recebidas para a automação.
- **Governança de Segredos no Frontend:**
  - O segredo da API key é mantido exclusivamente em estado volátil de memória durante a exibição inicial. É terminantemente proibido gravar o segredo em `localStorage`, `sessionStorage`, `cookies` ou emitir em logs do navegador.

---

## 3. Fora de Escopo (Non-Goals)

1. **Gestão do ciclo de vida de incidentes:** transições para `ACKNOWLEDGED`, `INVESTIGATING` ou `RESOLVED` (pertence à change 04).
2. **Atribuição e assunção de incidentes por analistas:** (pertence à change 04).
3. **Análise de causa-raiz assistida por IA via OpenRouter:** (pertence à change 04).
4. **Dashboard analítico com métricas MTTA e MTTR:** (pertence à change 05).
5. **OpenTelemetry e tracing distribuído em nível de produção:** (pertence à change 06).
6. **Testes E2E finais com Playwright:** (pertence à change 06).
7. **Empacotamento OCI Docker multi-stage e provisionamento Terraform:** (pertence à change 07).

---

## 4. Tabela de Entidades e Migrations

| Entidade | Tabela | Status neste Change | Descrição |
|---|---|---|---|
| `Automation` | `automations` | Nova (Migration versionada) | Entidade de automação monitorada |
| `ApiKey` | `api_keys` | Nova (Migration versionada) | Credencial de máquina com hash SHA-256 |
| `Execution` | `executions` | Nova (Migration versionada) | Registro de execuções recebidas |
| `Incident` | `incidents` | Nova (Migration versionada) | Fronteira do Fluxo 2 (somente status `OPEN`) |

---

## 5. Critérios de Aceite e Verificação

A change é considerada formalizada e apta à aprovação quando:
1. Todas as especificações delta estiverem concluídas com cenários BDD rastreáveis;
2. O plano arquitetural detalhar a geração segura de chaves, lookup SHA-256, mecanismo de idempotência e motor de severidade;
3. O backlog de tarefas decompor a implementação em passos executáveis de tamanho máximo médio;
4. As suítes de testes unitários, testes de integração Supertest e testes frontend com React Testing Library estiverem especificadas diretamente nas tarefas.
