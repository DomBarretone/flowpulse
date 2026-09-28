# Tasks: 04-incident-lifecycle-ai

## 1. Database Schema & Migration (Prisma Evolution)
- [ ] 1.1 Atualizar `apps/api/prisma/schema.prisma` com o novo enum `IncidentEventType` contendo `ACKNOWLEDGED`, `INVESTIGATION_STARTED`, `AI_ANALYSIS_REQUESTED`, `AI_ANALYSIS_COMPLETED` e `RESOLVED`.
- [ ] 1.2 Estender o modelo `Incident` no schema Prisma com os campos:
  - `assigned_to_id String?`
  - `acknowledged_at DateTime?`
  - `investigating_at DateTime?`
  - `resolved_at DateTime?`
  - `resolution_notes String? @db.Text`
  - Relação `assigned_to User? @relation("AssignedIncidents", fields: [assigned_to_id], references: [id], onDelete: SetNull)`
  - Relações `events IncidentEvent[]` e `ai_analyses AiAnalysis[]`
  - Índices `@@index([assigned_to_id, status])`
- [ ] 1.3 Adicionar as relações reversas no modelo `User` (`assigned_incidents Incident[]`, `incident_events IncidentEvent[]`, `ai_analyses AiAnalysis[]`).
- [ ] 1.4 Declarar o modelo `IncidentEvent` com `id`, `incident_id`, `actor_user_id`, `event_type`, `from_status`, `to_status`, `note`, `created_at` e índice em `[incident_id, created_at]`.
- [ ] 1.5 Declarar o modelo `AiAnalysis` com `id`, `incident_id`, `requested_by_id`, `model`, `summary`, `likely_causes` (Json), `evidence` (Json), `next_steps` (Json), `confidence` (Decimal 3,2), `provider_request_id`, `latency_ms`, `created_at` e índice em `[incident_id, created_at]`.
- [ ] 1.6 Executar migration versionada incremental via `npm run db:migrate` com o nome `add_incident_lifecycle_and_ai_analyses`, garantindo que os dados pré-existentes de incidentes `OPEN` permaneçam preservados e válidos.
- [ ] 1.7 Executar `npm run db:generate` para gerar os tipos e métodos tipados do Prisma Client atualizado.

## 2. Sanitizer Service & Security Guardrails
- [ ] 2.1 Implementar `SanitizerService` em `apps/api/src/common/sanitization/sanitizer.service.ts`:
  - Mascaramento determinístico de Bearer tokens por `Bearer [REDACTED]`;
  - Mascaramento de tokens JWT por `[REDACTED]`;
  - Mascaramento de chaves de integração FlowPulse `fp_live_*` por `[REDACTED]`;
  - Mascaramento de chaves de provedores `sk_*` e `pk_*` por `[REDACTED]`;
  - Mascaramento de atribuições de senhas/segredos (`password=`, `secret=`, `token=`, etc.) por `[REDACTED]`;
  - Mascaramento de endereços de email por `[REDACTED]`;
  - Mascaramento de parâmetros sensíveis em URLs.
- [ ] 2.2 Criar testes unitários para o `SanitizerService` em `apps/api/src/common/sanitization/sanitizer.service.spec.ts` cobrindo todos os padrões e garantindo preservação de texto operacional não-sensível.

## 3. OpenRouter Real Integration & Structured Output
- [ ] 3.1 Adicionar variáveis de ambiente seguras com valores de exemplo em `.env.example`:
  - `OPENROUTER_API_KEY=`
  - `OPENROUTER_MODEL=anthropic/claude-haiku-4.5`
  - `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
  - `OPENROUTER_APP_URL=http://localhost:3000`
  - `OPENROUTER_APP_NAME=FlowPulse`
  - `OPENROUTER_TIMEOUT_MS=15000`
- [ ] 3.2 Declarar interfaces TypeScript e DTOs de Structured Output em `apps/api/src/ai/dto/ai-analysis-output.dto.ts` com validação de esquema estrito (`summary`, `likely_causes: { cause, rationale }[]`, `evidence: string[]`, `next_steps: string[]`, `confidence: number 0..1`).
- [ ] 3.3 Implementar `OpenRouterService` em `apps/api/src/ai/openrouter.service.ts`:
  - Chamada HTTP via `fetch` server-side nativo direcionada a `${OPENROUTER_BASE_URL}/chat/completions`;
  - Injeção segura de cabeçalhos de autorização e rastreamento;
  - Parâmetro `response_format` configurado com JSON Schema estrito e `provider: { require_parameters: true }`;
  - Gestão de timeout de 15 segundos via `AbortController`;
  - Validação defensiva pós-resposta da conformidade do JSON retornado contra o schema;
  - Tratamento explícito de erros (401, 403, 429, 5xx, timeout, JSON malformado) lançando exceções RFC 7807 tratadas (503 Service Unavailable) sem expor chaves ou payloads internos nos logs.
- [ ] 3.4 Criar testes unitários em `apps/api/src/ai/openrouter.service.spec.ts` com mock de `fetch` cobrindo 200 OK com structured output, timeout via AbortController, erros 401/403/429/5xx, body vazio e JSON corrompido.

## 4. Incident Events Module & Audit Trail
- [ ] 4.1 Criar DTOs para consulta de eventos em `apps/api/src/incidents/dto/incident-event-response.dto.ts`.
- [ ] 4.2 Implementar método de gravação de eventos em `apps/api/src/incidents/incidents.service.ts` com suporte a execução dentro de transações Prisma (`tx.incidentEvent.create`).
- [ ] 4.3 Implementar consulta cronológica ascendente (`GET /api/v1/incidents/:id/events`) em `apps/api/src/incidents/incidents.controller.ts` protegido por `ClerkAuthGuard` e `RolesGuard`.
- [ ] 4.4 Criar testes unitários de gravação e consulta de eventos em `apps/api/src/incidents/incidents-events.spec.ts`.

## 5. Incidents Lifecycle Backend & State Machine
- [ ] 5.1 Criar DTOs de entrada e saída em `apps/api/src/incidents/dto/`:
  - `QueryIncidentsDto`: paginação (`page`, `limit`) e filtros (`status`, `severity`, `automation_id`, `assigned_to_id`);
  - `ResolveIncidentDto`: validação de `resolution_notes` (string, trim, min 10, max 2000);
  - `IncidentDetailResponseDto`: formatação completa do incidente com relações seguras.
- [ ] 5.2 Implementar métodos de ciclo de vida em `apps/api/src/incidents/incidents.service.ts`:
  - `findMany()`: listagem paginada com contagem total e filtros dinâmicos;
  - `findById()`: detalhe com automação, execução causadora e responsável;
  - `acknowledge()`: validação de status `OPEN`, mutação condicional atômica `updateMany` para `ACKNOWLEDGED`, atribuição de `assigned_to_id = user.id`, preenchimento de `acknowledged_at` e gravação de `IncidentEvent(ACKNOWLEDGED)` em transação; retorno de 409 se status não for `OPEN`;
  - `investigate()`: validação de status `ACKNOWLEDGED`, validação de ownership (apenas responsável atribuído ou `ADMIN`), mutação condicional atômica para `INVESTIGATING`, preenchimento de `investigating_at` e gravação de `IncidentEvent(INVESTIGATION_STARTED)` em transação; retorno de 403 se analista diferente e 409 se status inadequado;
  - `resolve()`: validação de status `INVESTIGATING`, validação de ownership, validação de `resolution_notes`, mutação condicional atômica para `RESOLVED`, preenchimento de `resolved_at`, gravação de `resolution_notes` e gravação de `IncidentEvent(RESOLVED)` em transação; retorno de 403 se analista diferente e 409 se status inadequado.
- [ ] 5.3 Atualizar `apps/api/src/incidents/incidents.controller.ts` expondo:
  - `GET /api/v1/incidents` (ADMIN, ANALYST)
  - `GET /api/v1/incidents/:id` (ADMIN, ANALYST)
  - `POST /api/v1/incidents/:id/acknowledge` (ADMIN, ANALYST)
  - `POST /api/v1/incidents/:id/investigate` (ADMIN, ANALYST)
  - `POST /api/v1/incidents/:id/resolve` (ADMIN, ANALYST)
- [ ] 5.4 Criar testes unitários para a máquina de estados em `apps/api/src/incidents/incidents.service.spec.ts`:
  - Validação de todas as transições legais;
  - Rejeição de transições ilegais (`OPEN → INVESTIGATING`, `OPEN → RESOLVED`, `ACKNOWLEDGED → RESOLVED`, `RESOLVED → OPEN`, etc.) com 409;
  - Rejeição de concorrência com 409;
  - Restrição de analista sobre incidente alheio com 403;
  - Autorização de administrador sobre qualquer incidente.

## 6. AI Assisted Analysis Backend Service & Controller
- [ ] 6.1 Implementar `AiAnalysisService` em `apps/api/src/incidents/ai-analysis.service.ts`:
  - Verificação de que o status do incidente é `INVESTIGATING` (rejeitando outros com 409);
  - Verificação de ownership (usuário é responsável atribuído ou `ADMIN`);
  - Carregamento read-only do contexto do incidente, automação e execução causadora;
  - Execução de sanitização determinística sobre a mensagem de erro e metadados;
  - Envio do payload sanitizado para o `OpenRouterService` fora de qualquer transação de banco;
  - Em caso de sucesso do OpenRouter, persistência atômica do registro em `ai_analyses` e emissão de `IncidentEvent(AI_ANALYSIS_COMPLETED)`;
  - Em caso de erro ou timeout do OpenRouter, propagação de HTTP 503 Problem Details mantendo o incidente intacto em `INVESTIGATING`;
  - Garantia de que nenhuma alteração de status do incidente é efetuada pela IA.
- [ ] 6.2 Adicionar endpoints no `apps/api/src/incidents/incidents.controller.ts`:
  - `POST /api/v1/incidents/:id/ai-analysis` (ADMIN, ANALYST com ownership)
  - `GET /api/v1/incidents/:id/ai-analyses` (ADMIN, ANALYST)
- [ ] 6.3 Criar testes unitários em `apps/api/src/incidents/ai-analysis.service.spec.ts` cobrindo sanitização pré-envio, persistência com mock de resposta válida, tratamento de 503 sem alteração de status e suporte a múltiplas análises.

## 7. Frontend Next.js 15 UI & Flows
- [ ] 7.1 Criar cliente de API e tipos TypeScript em `apps/web/src/lib/api/incidents.ts` para todos os endpoints (`listIncidents`, `getIncident`, `acknowledgeIncident`, `investigateIncident`, `requestAiAnalysis`, `resolveIncident`, `getIncidentEvents`, `getIncidentAiAnalyses`).
- [ ] 7.2 Atualizar o layout/navegação protegida em `apps/web/src/app/(protected)/layout.tsx` adicionando link acessível para `/incidents`.
- [ ] 7.3 Implementar a página de listagem em `apps/web/src/app/(protected)/incidents/page.tsx`:
  - Tabela com colunas: Severidade, Status, Automação, Aberto em, Responsável e Ações;
  - Badges acessíveis combinando cor + texto em caixa alta + ícone SVG;
  - Filtros suspensos para Status e Severidade;
  - Componente de paginação e empty states informativos;
  - Links direcionando para `/incidents/[id]`.
- [ ] 7.4 Criar componentes de apoio em `apps/web/src/components/incidents/`:
  - `IncidentStatusBadge`: representação tripla com texto, cor e ícone para conformidade WCAG;
  - `IncidentSeverityBadge`: representação tripla para severidade;
  - `IncidentTimeline`: renderização vertical cronológica dos eventos de histórico com timestamps legíveis;
  - `AiAnalysisCard`: painel com banner de caráter consultivo em destaque, aviso explícito contra ações automáticas, blocos de resumo, causas prováveis com justificativas, evidências, próximos passos e confiança percentual;
  - `ResolveIncidentModal`: diálogo acessível (`focus trap`, tecla Escape, label associado) para digitação de `resolution_notes` com contador de caracteres (mínimo 10), validação e estados de loading.
- [ ] 7.5 Implementar a página de detalhes em `apps/web/src/app/(protected)/incidents/[id]/page.tsx`:
  - Dados cadastrais do incidente, automação e execução primária com log de erro em bloco monoespaçado devidamente sanitizado;
  - Botões de ação contextuais com validação visual de papel e status:
    - `OPEN`: "Assumir Incidente";
    - `ACKNOWLEDGED`: "Iniciar Investigação";
    - `INVESTIGATING`: "Analisar com IA" e "Resolver Incidente";
    - `RESOLVED`: badges e notas em visualização de leitura imutável;
  - Prevenção de múltiplos cliques e estados visuais de loading nos botões;
  - Exibição de alertas amigáveis em caso de erros RFC 7807 (409, 403, 503).
- [ ] 7.6 Garantir acessibilidade WCAG 2.1 AA em todas as páginas e componentes de incidentes (foco visível, navegação por teclado, contraste mínimo 4.5:1 e anúncios com `aria-live`).

## 8. Comprehensive Test Suite
- [ ] 8.1 **Testes Unitários Backend (`apps/api` via Jest):**
  - Executar suíte completa validando `IncidentsService`, `SanitizerService`, `OpenRouterService`, `AiAnalysisService` e validadores DTO.
- [ ] 8.2 **Testes de Integração Backend (`apps/api` via Supertest):**
  - Criar `apps/api/test/incidents.e2e-spec.ts` cobrindo:
    - `GET /api/v1/incidents` sem autenticação -> 401;
    - `GET /api/v1/incidents` como `ADMIN` e `ANALYST` -> 200;
    - `POST /api/v1/incidents/:id/acknowledge` -> 200 atribuindo `assigned_to_id`;
    - Segunda requisição simultânea de `acknowledge` -> 409 Conflict;
    - `POST /api/v1/incidents/:id/investigate`: salto de `OPEN` -> 409; `ACKNOWLEDGED` próprio -> 200; analista alheio -> 403; `ADMIN` -> 200;
    - `POST /api/v1/incidents/:id/ai-analysis`: status inadequado -> 409; mock OpenRouter bem-sucedido -> 201 com entidade persistida; mock OpenRouter 503 -> 503 mantendo status `INVESTIGATING`;
    - `POST /api/v1/incidents/:id/resolve`: sem notas -> 422; notas válidas -> 200 avançando para `RESOLVED`; re-execução em `RESOLVED` -> 409;
    - `GET /api/v1/incidents/:id/events`: ordem cronológica confirmada;
    - Teste de fluxo completo ponta a ponta: `OPEN` -> `acknowledge` -> `investigate` -> `ai-analysis` -> `resolve` -> `RESOLVED`.
- [ ] 8.3 **Testes de Frontend (`apps/web` via Jest / React Testing Library):**
  - Criar testes de componentes e páginas para `/incidents` e `/incidents/[id]`:
    - Listagem renderizando itens e empty state;
    - Filtragem por status e severidade;
    - Transição de botões conforme status atual;
    - Modal de resolução bloqueando envio com notas em branco ou menores que 10 caracteres;
    - Renderização do card de diagnóstico assistido com rotulagem consultiva e ausência de afirmação definitiva;
    - Tratamento de erro 503 da IA sem quebra de tela.

## 9. Quality Gates & Closure Verification
- [ ] 9.1 Executar `npm run db:generate` no backend garantindo integridade dos tipos Prisma.
- [ ] 9.2 Executar `npm run db:migrate` garantindo migração limpa sem conflitos.
- [ ] 9.3 Executar `npm run lint` na raiz garantindo 0 errors e 0 warnings.
- [ ] 9.4 Executar `npm run typecheck` na raiz garantindo 0 erros de tipagem TypeScript.
- [ ] 9.5 Executar `npm run test` garantindo 100% dos testes unitários e de integração passando.
- [ ] 9.6 Executar `npm run build` garantindo compilação de produção com sucesso de `apps/api` e `apps/web`.
- [ ] 9.7 Executar `docker compose config` validando sintaxe e configuração de infraestrutura local.
