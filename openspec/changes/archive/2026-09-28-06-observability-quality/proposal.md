# Proposal: 06-observability-quality

## Why

O FlowPulse completou as camadas fundamentais de autenticação, ingestão de automações, gestão de incidentes assistida por IA e métricas operacionais, mas ainda opera sem observabilidade técnica integrada, correlação ponta a ponta de rastreabilidade, auditoria operacional estruturada e validação automatizada dos fluxos centrais de negócio. Esta mudança eleva a plataforma ao padrão de maturidade de produção através da instrumentação OpenTelemetry server-side, logs JSON estruturados com correlação entre requisições e spans, conformidade de acessibilidade WCAG 2.1 AA na interface web, testes ponta a ponta Playwright dos fluxos obrigatórios e quality gates locais rigorosos.

## What Changes

- **Instrumentação OpenTelemetry no Backend (`apps/api`)**: Inicialização do NodeSDK antes da instanciação do NestJS (`src/tracing.ts` importado no topo de `src/main.ts`), cobrindo rastreamento automático de requisições HTTP inbound (Express), chamadas outbound (Fetch/Undici para OpenRouter e HTTP/HTTPS para Clerk JWKS), queries Prisma ORM (`@prisma/instrumentation`) e propagação de contexto W3C Trace Context (`traceparent`).
- **Resiliência e Exportação OTLP Configurável**: Configuração do exportador OTLP via variáveis de ambiente (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`), garantindo que o backend inicialize e opere perfeitamente mesmo sem collector local ativo. O endpoint `GET /api/v1/health` permanece desacoplado da disponibilidade do collector.
- **Correlação de Request ID e Trace ID**: Preservação do `X-Request-ID` (reutilização ou geração de UUID v4) e injeção do header de resposta `X-Trace-ID` derivado do span ativo do OpenTelemetry. Inclusão de `trace_id` no formato RFC 7807 (`ProblemDetailsExceptionFilter`) e atualização das regras de CORS (`allowedHeaders` e `exposedHeaders`).
- **Logs Estruturados em JSON**: Substituição das saídas textuais do NestJS por um `JsonLoggerService` que emite JSON padronizado com campos obrigatórios (`timestamp`, `level`, `service`, `environment`, `event_name`, `request_id`, `trace_id`) e metadados contextuais seguros.
- **Sanitização Rigorosa de Logs e Não-Regressão**: Integração do `SanitizerService` na camada de logging para impedir vazamento de senhas, tokens Bearer, JWTs, Clerk secrets, chaves `fp_live_...` e chaves de provedores de IA. Manutenção estrita da proteção contra interpolação direta de mensagens de exceções externas no `OpenRouterService`.
- **Auditoria Operacional Completa Sem Migrations**: Consolidação do rastreamento de ações administrativas e operacionais (criação/ativação/desativação de automação, geração/revogação de API key, ingestão de execução) por meio de logs de auditoria estruturados correlacionados, complementando os eventos de ciclo de vida já imutavelmente persistidos em `incident_events`. Confirmação explícita de zero alterações no schema do Prisma.
- **Acessibilidade WCAG 2.1 AA no Frontend (`apps/web`)**: Revisão e conformidade das páginas principais (`/dashboard`, `/automations`, `/automations/[id]`, `/automations/new`, `/incidents`, `/incidents/[id]`), assegurando navegação completa por teclado, indicadores visíveis de foco (`focus-visible`), landmarks semânticos, tabelas acessíveis, badges combinando texto + cor + ícone e gerenciamento de foco no modal de resolução.
- **Suíte E2E Playwright (`tests/e2e/`)**: Configuração do Playwright com script `npm run test:e2e`, automação de inicialização via `webServer`, captura econômica de artefatos de debug (`trace`, `screenshot`, `video` em caso de falha) e exclusão no `.gitignore`.
- **E2E Fluxo 1 (Onboarding e Ativação de Automação)**: Teste automatizado cobrindo autenticação, criação de automação com criticidade HIGH, geração de credencial com exibição única em memória, envio de execução de teste (`is_test: true`), validação do status `VALIDATED` e ativação para status `ACTIVE`.
- **E2E Fluxo 2 (Lifecycle de Incidente e IA Consultiva)**: Teste automatizado cobrindo envio de execução `FAILED` produtiva, detecção de incidente `OPEN`, atribuição ao operador (`ACKNOWLEDGED`), início de investigação (`INVESTIGATING`), solicitação de análise de IA com exibição de card estruturado e aviso consultivo, e resolução com `resolution_notes` obrigatórias validando a timeline completa.
- **Double Determinístico de Teste para OpenRouter**: Mock HTTP da fronteira externa do OpenRouter executado exclusivamente durante testes E2E via `OPENROUTER_BASE_URL`, preservando o código de produção intacto, consumindo zero créditos externos e validando a integração completa da aplicação com a boundary de IA.
- **Autenticação Segura no E2E com Clerk**: Configuração de credenciais de teste isoladas via variáveis de ambiente com documentação de placeholders em `.env.example` e preservação de estado de sessão (`storageState`), sem dados sensíveis versionados.
- **Quality Gates Locais Formalizados**: Consolidação dos gates locais de qualidade (`db:generate`, `db:migrate`, `lint`, `typecheck`, `test`, `test:e2e`, `build`, `docker compose config`), mantendo a execução serializada do Jest na API (`--runInBand`) para estabilidade.

## Capabilities

### New Capabilities

- `otel-observability`: Instrumentação técnica do backend com OpenTelemetry NodeSDK, propagação W3C Trace Context, injeção de headers de correlação `X-Request-ID` e `X-Trace-ID`, exportação OTLP resiliente e suporte nativo ao Prisma ORM.
- `structured-logging`: Emissão de logs operacionais em formato JSON estruturado no NestJS com correlação direta a `request_id` e `trace_id`, metadados padronizados e sanitização estrita de segredos e dados sensíveis.
- `operational-audit`: Garantia de auditabilidade para todas as operações críticas e transições de estado da plataforma, combinando o histórico relacional de `IncidentEvent` com eventos estruturados de log para operações administrativas.
- `accessibility-quality`: Conformidade de acessibilidade WCAG 2.1 AA nas páginas centrais do frontend, assegurando navegação por teclado, foco visível, contraste, landmarks semânticos e redundância visual de status.
- `playwright-e2e`: Suíte de testes ponta a ponta Playwright cobrindo os Fluxos de Negócio 1 e 2 na interface web e API, com mock determinístico da fronteira OpenRouter e autenticação Clerk isolada para testes.
- `quality-gates`: Conjunto canônico de verificações locais de qualidade de código, tipagem, formatação, testes unitários, testes de integração, testes E2E e validação de compose.

### Modified Capabilities

Nenhuma capability existente tem seus requisitos funcionais alterados. As novas capabilities agregam requisitos normativos de observabilidade, rastreabilidade, qualidade, auditoria e testes ponta a ponta sem modificar os contratos de negócio anteriores.

## Impact

- **Backend (`apps/api`)**: Dependências adicionadas (`@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/api`, `@prisma/instrumentation`). Novo módulo `src/tracing.ts` executado no bootstrap da aplicação. Novo `JsonLoggerService` e interceptor de logging HTTP. Atualização de `RequestIdMiddleware`, `ProblemDetailsExceptionFilter` e CORS em `main.ts`.
- **Frontend (`apps/web`)**: Refinamento de atributos de acessibilidade (`aria-*`, `role`, `focus-visible`, `htmlFor`, semântica de tabelas) nas páginas e componentes principais sem impacto visual destrutivo.
- **Testes (`tests/e2e`)**: Instalação do `@playwright/test` e dependências auxiliares. Criação da estrutura de testes em `tests/e2e/`, mock da fronteira OpenRouter e configuração do Playwright.
- **Configuração e CI Local**: Scripts raiz atualizados (`npm run test:e2e`), `.env.example` atualizado com variáveis OTel e E2E, e `.gitignore` atualizado para isolar relatórios e artefatos de teste.
- **Banco de Dados**: Zero migrations no Prisma. Nenhuma alteração no `schema.prisma`.
