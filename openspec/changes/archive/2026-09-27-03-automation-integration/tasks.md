# Tasks: 03-automation-integration

## 1. Database Schema & Migration (Prisma Evolution)
- [x] 1.1 Atualizar `apps/api/prisma/schema.prisma` com os enums `Criticality` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `AutomationStatus` (`DRAFT`, `ACTIVE`, `INACTIVE`), `IntegrationStatus` (`PENDING`, `VALIDATED`, `FAILED`), `ExecutionStatus` (`RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`), `IncidentStatus` (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`) e `IncidentSeverity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- [x] 1.2 Declarar o modelo `Automation` no schema Prisma com `id`, `name`, `description`, `owner_id`, `criticality`, `expected_duration_seconds`, `status`, `integration_status`, timestamps e relações.
- [x] 1.3 Declarar o modelo `ApiKey` com `id`, `automation_id`, `key_hash` (único e indexado), `prefix`, `created_at`, `revoked_at` e `last_used_at`.
- [x] 1.4 Declarar o modelo `Execution` com `id`, `automation_id`, `external_execution_id`, `status`, `started_at`, `finished_at`, `duration_ms`, `error_message`, `is_test`, `created_at` e a constraint `@@unique([automation_id, external_execution_id])`.
- [x] 1.5 Declarar o modelo mínimo `Incident` com `id`, `automation_id`, `execution_id` (único), `status` (`OPEN`), `severity`, `opened_at`, `created_at`, `updated_at` e relações de integridade.
- [x] 1.6 Gerar migration versionada incremental via `npm run db:migrate` (`add_automations_api_keys_executions_incidents`), garantindo que `prisma db push` não seja utilizado.
- [x] 1.7 Executar `npm run db:generate` para gerar os tipos e métodos tipados no Prisma Client.

## 2. ApiKey Management & Cryptographic Guard
- [x] 2.1 Implementar `ApiKeyService` em `apps/api/src/api-keys/api-key.service.ts`:
  - Geração de segredo criptograficamente aleatório de 256 bits com `crypto.randomBytes(32)` e prefixo `fp_live_`;
  - Cálculo determinístico de hash SHA-256 do segredo;
  - Persistência exclusiva do hash SHA-256 e do prefixo seguro na tabela `api_keys`;
  - Revogação imediata via marcação de `revoked_at`.
- [x] 2.2 Implementar `ApiKeyGuard` em `apps/api/src/common/guards/api-key.guard.ts`:
  - Extração do cabeçalho `x-api-key`;
  - Rejeição de ausência ou formato incorreto com HTTP 401 Problem Details RFC 7807 contendo `request_id`;
  - Busca indexada por hash SHA-256 na tabela `api_keys` com filtro `revoked_at IS NULL`;
  - Rejeição de chave revogada com HTTP 401;
  - Atualização do timestamp `last_used_at`;
  - Injeção da automação correspondente no objeto de requisição (`request.automation`).
- [x] 2.3 Garantir que nenhuma chave pura ou hash seja emitido em logs ou em respostas de erro.

## 3. Automations Backend Module & Business Logic
- [x] 3.1 Criar DTOs em `apps/api/src/automations/dto/`:
  - `CreateAutomationDto`: validação de `name`, `description`, `criticality` e `expected_duration_seconds` (inteiro positivo > 0) com `class-validator`;
  - `UpdateAutomationDto`: atualização parcial cadastral;
  - Configuração de `ValidationPipe` rejeitando campos não declarados.
- [x] 3.2 Implementar `AutomationsService` em `apps/api/src/automations/automations.service.ts`:
  - Criação de automação em `status: DRAFT` e `integration_status: PENDING` vinculada ao usuário autenticado (`owner_id`);
  - Listagem com filtros por status e criticidade e consulta por ID;
  - Regra de ativação: transição para `ACTIVE` permitida estritamente se `integration_status === VALIDATED`;
  - Regra de desativação: transição para `INACTIVE`;
  - Emissão de API key vinculada à automação e retorno do segredo uma única vez;
  - Revogação de API key vinculada.
- [x] 3.3 Implementar `AutomationsController` em `apps/api/src/automations/automations.controller.ts`:
  - Aplicação de `ClerkAuthGuard` e `RolesGuard`;
  - Restrição ao papel `ADMIN` para `POST /api/v1/automations`, `PATCH /api/v1/automations/:id`, `POST /api/v1/automations/:id/activate`, `POST /api/v1/automations/:id/deactivate`, `POST /api/v1/automations/:id/api-keys` e `POST /api/v1/automations/:id/api-keys/:keyId/revoke`;
  - Acesso concedido a `ADMIN` e `ANALYST` para `GET /api/v1/automations` e `GET /api/v1/automations/:id`.

## 4. Executions Ingestion Pipeline & Real Integration Test
- [x] 4.1 Criar DTOs em `apps/api/src/executions/dto/`:
  - `IngestExecutionDto`: `external_execution_id`, `status` (`RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`), `started_at`, `finished_at`, `duration_ms`, `error_message`, `is_test`;
  - Validação estrita sem aceitar `automation_id` no corpo.
- [x] 4.2 Implementar `ExecutionsService` em `apps/api/src/executions/executions.service.ts`:
  - Persistência atômica da execução vinculada à automação autenticada pelo `ApiKeyGuard`;
  - Tratamento de idempotência: busca prévia por `(automation_id, external_execution_id)`. Se já existente, retorna a execução original com status 200 OK sem duplicar linha e sem disparar novos incidentes;
  - Validação real de integração: caso `is_test: true`, atualiza `Automation.integration_status` para `VALIDATED` e impede a criação de incidentes;
  - Consulta paginada do histórico de execuções com filtros.
- [x] 4.3 Implementar `ExecutionsController` em `apps/api/src/executions/executions.controller.ts`:
  - `POST /api/v1/executions` protegido por `ApiKeyGuard` (sem sessão Clerk);
  - `GET /api/v1/executions` protegido por `ClerkAuthGuard` e `RolesGuard` (`ADMIN` e `ANALYST`).

## 5. Incident Creation Boundary (Fluxo 2 Hand-off)
- [x] 5.1 Implementar motor puro de severidade em `apps/api/src/incidents/incident-severity.calculator.ts`:
  - Mapeamento determinístico de criticidade para severidade em caso de falha:
    - `CRITICAL` -> `CRITICAL`
    - `HIGH` -> `CRITICAL`
    - `MEDIUM` -> `HIGH`
    - `LOW` -> `MEDIUM`
- [x] 5.2 Implementar serviço de abertura de incidente em `apps/api/src/incidents/incidents.service.ts`:
  - Criação automática de `Incident` em status `OPEN` quando `is_test === false`, `status === FAILED` e `Automation.status === ACTIVE`;
  - Garantir que execuções de teste (`is_test: true`) e reenvios idempotentes nunca gerem incidentes;
  - Retornar `incident_id` no payload de resposta de `POST /api/v1/executions`.

## 6. Frontend Next.js 15 UI & Flows
- [x] 6.1 Criar cliente de API e tipos TypeScript em `apps/web/src/lib/api/automations.ts` e `executions.ts`.
- [x] 6.2 Implementar página de listagem `/automations` em `apps/web/src/app/(protected)/automations/page.tsx`:
  - Tabela com indicadores de status, criticidade e status de integração (cor + texto + ícone);
  - Botão "Nova Automação" condicionado ao papel `ADMIN`.
- [x] 6.3 Implementar página de cadastro `/automations/new` em `apps/web/src/app/(protected)/automations/new/page.tsx`:
  - Formulário com validação client-side e feedback de erro RFC 7807;
  - Redirecionamento após criação para `/automations/[id]`.
- [x] 6.4 Implementar página de detalhes `/automations/[id]` em `apps/web/src/app/(protected)/automations/[id]/page.tsx`:
  - Painel com parâmetros da automação;
  - Seção de credenciais: botão de geração (ADMIN), aviso prévio de visualização única, modal com o segredo completo `fp_live_...` e botão de cópia;
  - Garantir que o segredo completo permaneça apenas em estado volátil de memória e nunca seja persistido em `localStorage`, `sessionStorage` ou `cookies`;
  - Listagem de chaves ativas/revogadas exibindo apenas o prefixo seguro mascarado;
  - Guia de teste com snippet cURL de execução de teste (`is_test: true`);
  - Indicador visual do status de integração (`PENDING`, `VALIDATED`, `FAILED`);
  - Botão "Ativar Monitoramento": desabilitado enquanto `integration_status != VALIDATED`, habilitado dinamicamente após validação;
  - Tabela com histórico de execuções recentes da automação.
- [x] 6.5 Garantir acessibilidade WCAG 2.1 AA (foco visível, navegação por teclado, rótulos de formulário e contraste de texto mínimo 4.5:1).

## 7. Comprehensive Test Suite
- [x] 7.1 **Testes Unitários Backend (`apps/api` via Jest):**
  - `AutomationService`: criação em `DRAFT`/`PENDING`, validação de duração positiva, bloqueio de ativação com integração `PENDING`, ativação permitida com integração `VALIDATED`, desativação para `INACTIVE`;
  - `ApiKeyService`: geração de chave com prefixo `fp_live_` e entropia forte, garantia de hash SHA-256 no banco e ausência do segredo puro, revogação imediata;
  - `ApiKeyGuard`: ausência de cabeçalho -> 401 RFC 7807, formato inválido -> 401, chave revogada -> 401, chave inexistente -> 401, chave válida -> autorização e injeção da automação no contexto;
  - `ExecutionService`: persistência válida, idempotência (mesmo `external_execution_id` não insere linha duplicada), evento de teste atualiza `integration_status` para `VALIDATED` sem gerar incidente, execução produtiva `FAILED` em automação `ACTIVE` gera `Incident` `OPEN`, reenvio de execução não gera segundo incidente;
  - Calculador de severidade: validação unitária de todas as combinações de criticidade da automação para severidade do incidente;
  - Autorização RBAC: analista proibido de criar, editar, ativar e gerar chave; administrador autorizado.
- [x] 7.2 **Testes de Integração Backend (`apps/api` via Supertest):**
  - `POST /api/v1/automations` sem autenticação -> 401 RFC 7807;
  - `POST /api/v1/automations` como `ANALYST` -> 403 RFC 7807;
  - `POST /api/v1/automations` como `ADMIN` -> 201 Created;
  - `POST /api/v1/automations/:id/api-keys` -> 201 Created retornando `secret` uma única vez;
  - `GET /api/v1/automations/:id` -> não expõe `secret` nem `key_hash`;
  - `POST /api/v1/executions` sem `x-api-key` -> 401 RFC 7807;
  - `POST /api/v1/executions` com `x-api-key` inválida ou revogada -> 401 RFC 7807;
  - `POST /api/v1/executions` com `is_test: true` -> 201 Created, `integration_status` atualizado para `VALIDATED`, sem incidente;
  - `POST /api/v1/automations/:id/activate` antes de validação -> 422 RFC 7807;
  - `POST /api/v1/automations/:id/activate` após validação -> 200 OK com status `ACTIVE`;
  - `POST /api/v1/executions` real com `SUCCESS` -> 201 Created sem incidente;
  - `POST /api/v1/executions` real com `FAILED` em automação ativa -> 201 Created com criação de `Incident` em status `OPEN`;
  - Reenvio da mesma execução -> 200 OK idempotente sem criação de incidente duplicado.
- [x] 7.3 **Testes de Componentes Frontend (`apps/web` via Jest + React Testing Library):**
  - Renderização da listagem de automações e empty state;
  - Submissão do formulário de criação de automação;
  - Exibição one-time do segredo no modal e confirmação de que o segredo não persiste no DOM ou storage após fechamento;
  - Renderização do badge de status de integração (`PENDING` vs `VALIDATED`);
  - Botão de ativação desabilitado quando `PENDING` e habilitado quando `VALIDATED`;
  - Renderização da tabela de execuções recentes;
  - Controles administrativos ocultos ou desabilitados para usuário com papel `ANALYST`.

## 8. Quality Gates & Verification Closure
- [x] 8.1 Executar `npm run db:generate` garantindo atualização completa dos tipos do Prisma.
- [x] 8.2 Executar `npm run db:migrate` garantindo aplicação das migrações incrementais sem erros.
- [x] 8.3 Executar `npm run lint` na raiz garantindo zero advertências ou erros no ESLint.
- [x] 8.4 Executar `npm run typecheck` validando tipagem estrita no backend e frontend (`tsc --noEmit`).
- [x] 8.5 Executar `npm run test` garantindo 100% de sucesso nos testes unitários e de integração.
- [x] 8.6 Executar `npm run build` confirmando compilação bem-sucedida de todas as aplicações (`apps/api` e `apps/web`).
- [x] 8.7 Validar `docker compose config` garantindo integridade dos descritores de ambiente.
- [x] 8.8 Confirmar ausência de segredos reais, tokens ou chaves versionadas no repositório.
