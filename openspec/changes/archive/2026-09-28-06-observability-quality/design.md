# Design: 06-observability-quality

## Context

O FlowPulse atingiu maturidade funcional nos módulos de autenticação, catálogo de automações, ingestão idempotente de execuções, ciclo de vida de incidentes assistido por IA e cálculo de métricas operacionais (MTTA/MTTR). Contudo, o sistema ainda carece de telemetria técnica distribuída, correlação sistemática entre requisições e traces, logs operacionais em JSON estruturado, testes ponta a ponta automatizados e garantia de acessibilidade WCAG 2.1 AA.

A inspeção do repositório confirmou:
- `apps/api`: NestJS 11, Node 22, Prisma 6.4.1, `uuid` v4, sem OpenTelemetry ou Pino instalados.
- `apps/web`: Next.js 15 (App Router), React 19, Tailwind CSS, `@clerk/nextjs` 7.
- Persistência: O banco possui as tabelas `users`, `automations`, `api_keys`, `executions`, `incidents`, `incident_events` e `ai_analyses`. Não existe e não deve ser criada tabela `audit_logs`.
- Testes atuais: 24 suítes unitárias/integração na API (`jest --runInBand`) e 8 suítes no Web, totalizando 186 testes passando com código de saída 0.
- `tests/e2e`: Contém apenas `.gitkeep` e requer formalização da suíte Playwright para os Fluxos 1 e 2.

Para motivação detalhada, consulte `proposal.md - Why`.

## Goals / Non-Goals

**Goals:**
- Instrumentação OpenTelemetry no backend para tracing automático de requisições inbound, outbound (Fetch para OpenRouter e HTTP para Clerk), e Prisma ORM.
- Propagação de contexto W3C Trace Context (`traceparent`) e correlação com `request_id` e `trace_id` nos headers de resposta (`X-Request-ID`, `X-Trace-ID`) e no corpo RFC 7807 (`ProblemDetailsExceptionFilter`).
- Logs operacionais em formato JSON estruturado emitidos pelo NestJS com campos obrigatórios (`timestamp`, `level`, `service`, `environment`, `event_name`, `request_id`, `trace_id`) e sanitização de dados sensíveis.
- Auditoria operacional integral sem novas migrações de banco, combinando o histórico relacional de `IncidentEvent` com logs estruturados de auditoria para operações administrativas.
- Acessibilidade WCAG 2.1 AA nas páginas centrais (`/dashboard`, `/automations`, `/automations/[id]`, `/automations/new`, `/incidents`, `/incidents/[id]`).
- Suíte Playwright E2E em `tests/e2e/` cobrindo integralmente o Fluxo 1 (onboarding e ativação de automação) e o Fluxo 2 (ciclo de incidente com análise de IA consultiva e resolução).
- Double determinístico de teste para OpenRouter operando exclusivamente na boundary HTTP externa do E2E via `OPENROUTER_BASE_URL` sem custos e sem alterar código de produção.
- Quality gates locais consolidados executando em sequência com código de saída zero.

**Non-Goals:**
- Provisionamento ou configuração de collectors OTLP externos, Jaeger, Prometheus ou Grafana (escopo da change 07 / infraestrutura).
- Containerização OCI de produção, Dockerfiles multi-stage finais e Terraform (escopo da change 07).
- Instrumentação OpenTelemetry no frontend browser (foco de RNF-04 é backend, execuções e incidentes).
- Criação de novas funcionalidades de negócio (alertas, detecção de anomalias, automações ativas de remediação, revogação de chaves fora do modelo existente).
- Criação de nova tabela relacional `audit_logs`.

## Decisions

### 1. Inicialização do OpenTelemetry SDK no NestJS
- **Decisão**: Criar `apps/api/src/tracing.ts` que instancia e inicializa o `NodeSDK` do OpenTelemetry imediatamente no carregamento do arquivo, sendo importado como a PRIMEIRA linha de `apps/api/src/main.ts` (`import './tracing';`).
- **Alternativas consideradas**:
  - *Opção A: Flag de CLI `--require dist/tracing.js`*: Requer alterar scripts de dev (`nest start --watch`), ts-node e scripts de build, quebrando a ergonomia local padrão do NestJS CLI.
  - *Opção B: Módulo NestJS (`TracingModule`)*: O ciclo de vida do NestJS inicializa os módulos após Express e bibliotecas HTTP já terem sido importados, perdendo o monkey-patching essencial para auto-instrumentação de inbound/outbound.
  - *Opção Escolhida*: Top-level `import './tracing'` garante execução antes de qualquer importação de `@nestjs/core`, Express ou Prisma, operando de forma transparente em `nest start --watch`, `ts-node` e `node dist/main`.
- **Bibliotecas**:
  - `@opentelemetry/sdk-node`
  - `@opentelemetry/auto-instrumentations-node`
  - `@opentelemetry/exporter-trace-otlp-http`
  - `@opentelemetry/api`
  - `@prisma/instrumentation` (instrumentação oficial do Prisma Client)

### 2. Resiliência do Exportador OTLP
- **Decisão**: Configurar o exportador OTLP condicionalmente com base em `process.env.OTEL_EXPORTER_OTLP_ENDPOINT`. Se a variável estiver ausente ou vazia, o SDK inicializa sem exportador de rede, evitando falhas de inicialização ou timeouts em ambiente de desenvolvimento local. Quando configurado, utiliza `BatchSpanProcessor`, processando traces em lote de forma assíncrona. Se o collector estiver inacessível, as falhas são tratadas em background sem derrubar a API ou impactar o endpoint `/api/v1/health`.
- **Alternativas consideradas**:
  - *Falha fatal na ausência de collector*: Inviável para desenvolvimento local e testes unitários.
  - *Exportador síncrono (SimpleSpanProcessor)*: Bloquearia o event loop a cada requisição HTTP, degradando severamente a latência.

### 3. Estratégia de Logs Estruturados em JSON
- **Decisão**: Implementar `JsonLoggerService` estendendo `ConsoleLogger` / implementando `LoggerService` nativo do NestJS, associado a um interceptor global de logging HTTP.
- **Justificativa da escolha (vs Pino/nestjs-pino)**:
  - O `JsonLoggerService` customizado possui custo zero de dependências pesadas, sem complexidade de workers em threads separadas ou problemas de serialização em testes Jest.
  - Permite controle exato da formatação de campos obrigatórios (`timestamp`, `level`, `service`, `environment`, `event_name`, `request_id`, `trace_id`).
  - Integra-se diretamente ao `SanitizerService` existente do FlowPulse para redação determinística de credenciais antes do `JSON.stringify`.
  - Compatibilidade 100% nativa com NestJS 11 e `jest --runInBand`.

### 4. Correlação de Request ID, Trace ID e Headers
- **Decisão**:
  - Manter o `RequestIdMiddleware` existente: extrai `x-request-id` do cabeçalho da requisição ou gera UUID v4; define no header de resposta e no objeto da requisição Express.
  - Integrar com OpenTelemetry API (`trace.getActiveSpan()`): extrai o `traceId` hexadecimal (32 chars) do span ativo e injeta o header de resposta `x-trace-id`.
  - Atualizar `main.ts` (CORS): adicionar `x-request-id`, `traceparent`, `tracestate` em `allowedHeaders`, e `x-request-id`, `x-trace-id` em `exposedHeaders`.
  - Atualizar `ProblemDetailsExceptionFilter`: incluir `trace_id` junto a `request_id` na estrutura RFC 7807.

### 5. Auditoria Operacional Sem Migrations de Banco
- **Decisão**: Utilizar estritamente as estruturas existentes. O histórico relacional de incidentes já é garantido pela entidade `IncidentEvent` (`ACKNOWLEDGED`, `INVESTIGATION_STARTED`, `AI_ANALYSIS_REQUESTED`, `AI_ANALYSIS_COMPLETED`, `RESOLVED`). As operações administrativas fora do ciclo de incidentes (criação de automação, geração de API key, revogação de API key, ativação de automação, ingestão de execução) passam a emitir logs estruturados com `event_name: "automation_created"`, `"api_key_generated"`, `"api_key_revoked"`, `"automation_activated"`, `"execution_ingested"`, contendo o ID do recurso, ator, prefixo de chave e IDs de correlação (`request_id`, `trace_id`).
- **Justificativa**: Evita duplicidade com `IncidentEvent`, não introduz migrações desnecessárias no banco de dados e atende plenamente o RNF-04 de auditabilidade e rastreabilidade operacional.

### 6. Mock Determinístico do OpenRouter no E2E
- **Decisão**: Aproveitar a variável `OPENROUTER_BASE_URL` já suportada em `OpenRouterService`. Durante os testes E2E, a suíte Playwright sobe um servidor HTTP leve (porta 3002) que intercepta `POST /chat/completions` e retorna um payload estruturado válido aderente ao JSON Schema exigido.
- **Justificativa**:
  - Código produtivo permanece 100% inalterado (sem flags de mock ou backdoors).
  - A requisição percorre a stack inteira: Navegador -> Frontend -> Backend -> AiAnalysisService -> Boundary Externa -> Sanitização -> Persistência de AiAnalysis e IncidentEvent -> Atualização da UI.
  - Custo zero de tokens e 100% de determinismo em CI/local.

### 7. Autenticação Clerk no Playwright E2E
- **Decisão**: Utilizar o padrão oficial de `storageState` do Playwright associado a credenciais de teste fornecidas via variáveis de ambiente (`E2E_CLERK_USER_EMAIL`, `E2E_CLERK_USER_PASSWORD`). O script `auth.setup.ts` realiza o login inicial via Clerk, valida a sessão e persiste o estado em `playwright/.auth/user.json` (ignorado no git). Os testes reutilizam essa sessão autenticada.
- **Justificativa**: Elimina repetição de login a cada teste, previne rate-limiting do provedor e não versiona segredos.

### 8. Acessibilidade WCAG 2.1 AA
- **Decisão**: Aplicar correções cirúrgicas nas 6 páginas principais:
  - Foco visível: classes Tailwind `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none`.
  - Navegação por teclado: assegurar que todos os botões, links e triggers sejam focalizáveis e acionáveis via Enter/Space.
  - Tabelas semânticas: cabeçalhos com `<th scope="col">` e rótulos acessíveis.
  - Dialogs: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, captura de foco no `ResolveIncidentModal` e fechamento com Escape.
  - Redundância visual: status e severidade com texto descritivo + ícone com `aria-hidden="true"` + cor com contraste mínimo 4.5:1.

## Risks / Trade-offs

- **[Risk] Falha de conexão ou timeout na exportação OTLP impactar a latência da API**  
  → *Mitigation*: O `BatchSpanProcessor` gerencia a fila em background sem bloquear o event loop. Em desenvolvimento sem collector, a ausência de `OTEL_EXPORTER_OTLP_ENDPOINT` desativa o exportador de rede.
- **[Risk] Vazamento inadvertido de chaves de API (`fp_live_...`) ou tokens em logs JSON**  
  → *Mitigation*: Todo payload logado passa pelo `SanitizerService` antes da escrita. Headers sensíveis (`authorization`, `x-api-key`, `cookie`) são explicitamente bloqueados. Testes automatizados validam a ausência de segredos em logs.
- **[Risk] Regressão no tratamento de erros do `OpenRouterService`**  
  → *Mitigation*: O `OpenRouterService` mantém a regra estrita de não interpolar `error.message` de terceiros em logs. Teste unitário dedicado valida essa garantia.
- **[Risk] Flakiness nos testes Playwright devido a estado residual no banco**  
  → *Mitigation*: Cada execução E2E gera nomes únicos com timestamp (`e2e-auto-${Date.now()}`) e executa limpeza pontual apenas dos seus próprios dados gerados. Nunca executa `prisma migrate reset` ou `TRUNCATE`.
- **[Risk] Conflito de portas entre servidores de teste e instâncias em execução**  
  → *Mitigation*: O `webServer` do Playwright utiliza `reuseExistingServer: !process.env.CI` e valida os endpoints de liveness (`/api/v1/health` e `/`).

## Migration Plan

1. **Instalação de Dependências**: Adicionar pacotes OpenTelemetry em `apps/api` e `@playwright/test` na raiz.
2. **Nenhuma Alteração de Schema**: O banco de dados PostgreSQL permanece idêntico; nenhuma migration é gerada.
3. **Variáveis de Ambiente**: Atualizar `.env.example` com placeholders documentados para OpenTelemetry e E2E.
4. **Verificação de Regressão**: Executar a suíte de testes existente (`npm run test`) para assegurar que os 186 testes continuem verdes.
5. **Quality Gates**: Executar os gates completos locais (`npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build && docker compose config`).

## Open Questions

Nenhuma questão em aberto. Todas as decisões técnicas foram alinhadas com as diretrizes do `AGENTS.md` e a inspeção do código existente.
