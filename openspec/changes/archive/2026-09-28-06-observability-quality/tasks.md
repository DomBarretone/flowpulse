# Tasks: 06-observability-quality

## 1. Dependências e Configuração de Ambiente

- [x] 1.1 Adicionar dependências OpenTelemetry (`@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/api`, `@prisma/instrumentation`) em `apps/api/package.json` e verificar instalação bem-sucedida via `npm install`.
- [x] 1.2 Atualizar `.env.example` na raiz incluindo variáveis de configuração do OpenTelemetry (`OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_RESOURCE_ATTRIBUTES`) e variáveis de teste E2E (`E2E_CLERK_USER_EMAIL`, `E2E_CLERK_USER_PASSWORD`), e verificar que nenhum segredo real ou token está presente.
- [x] 1.3 Atualizar `.gitignore` adicionando pastas de relatórios e artefatos de teste (`playwright-report/`, `test-results/`, `playwright/.auth/`) e verificar que `git status` não rastreia essas pastas.

## 2. Tracing e Bootstrap do OpenTelemetry

- [x] 2.1 Criar módulo `apps/api/src/tracing.ts` com inicialização do `NodeSDK` do OpenTelemetry, suporte a `OTEL_SERVICE_NAME`, exportador OTLP HTTP condicional baseado em `OTEL_EXPORTER_OTLP_ENDPOINT`, instrumentação automática (`getNodeAutoInstrumentations`) e instrumentação do Prisma (`new PrismaInstrumentation()`), verificando que o arquivo é compilável pelo TypeScript sem erros.
- [x] 2.2 Importar `apps/api/src/tracing.ts` como a primeira instrução em `apps/api/src/main.ts` (`import './tracing';`) e verificar que a API inicializa normalmente via `npm run start -w apps/api` mesmo sem collector OTLP ativo.

## 3. Correlação de Request ID, Trace ID e Headers

- [x] 3.1 Atualizar `apps/api/src/common/middleware/request-id.middleware.ts` para extrair o `traceId` do span ativo via `@opentelemetry/api` (`trace.getActiveSpan()?.spanContext().traceId`) e configurar o header de resposta `X-Trace-ID`, verificando com teste unitário em `apps/api/test/request-id.middleware.spec.ts`.
- [x] 3.2 Atualizar `apps/api/src/common/filters/problem-details-exception.filter.ts` para incluir a propriedade `trace_id` no payload de erro RFC 7807 quando houver trace ativo, e verificar o formato com teste automatizado.
- [x] 3.3 Atualizar a configuração de CORS em `apps/api/src/main.ts` incluindo `x-request-id`, `traceparent` e `tracestate` em `allowedHeaders`, e `x-request-id` e `x-trace-id` em `exposedHeaders`, e verificar comportamento em requisição OPTIONS.

## 4. Logs Estruturados em JSON e Sanitização

- [x] 4.1 Criar `JsonLoggerService` em `apps/api/src/common/logging/json-logger.service.ts` implementando a interface `LoggerService` do NestJS com emissão de logs em linha única JSON contendo `timestamp`, `level`, `service`, `environment`, `event_name`, `request_id` e `trace_id`, e verificar formatação com teste unitário dedicado.
- [x] 4.2 Criar interceptor global `HttpLoggingInterceptor` em `apps/api/src/common/logging/http-logging.interceptor.ts` que registra structured log ao término de requisições com `event_name: "http_request_completed"`, `method`, `path`, `status_code` e `duration_ms`, e verificar com teste de integração.
- [x] 4.3 Configurar `app.useLogger(app.get(JsonLoggerService))` em `apps/api/src/main.ts` e integrar o `SanitizerService` na serialização para redigir tokens Bearer, JWTs, senhas e chaves `fp_live_...` com `[REDACTED]`, e verificar ausência de segredos em teste de sanitização.

## 5. Auditoria Operacional

- [x] 5.1 Adicionar emissão de logs estruturados de auditoria no `AutomationsService` para criação (`automation_created`), ativação (`automation_activated`) e desativação (`automation_deactivated`) contendo `automation_id` e ator, e verificar nos testes de `automations.service.spec.ts`.
- [x] 5.2 Adicionar emissão de logs estruturados de auditoria no `ApiKeyService` para geração (`api_key_generated`) e revogação (`api_key_revoked`) registrando `automation_id` e ID da chave sem expor o segredo, e verificar nos testes de `api-key.service.spec.ts`.
- [x] 5.3 Adicionar emissão de log estruturado de auditoria no `ExecutionsService` para ingestão de execução (`execution_ingested`) e criação automática de incidente (`incident_created`), e verificar nos testes de `executions.service.spec.ts`.
- [x] 5.4 Confirmar que nenhuma migração ou alteração no `schema.prisma` foi criada e verificar que `npx prisma migrate status` reporta conformidade com o banco de dados.

## 6. Acessibilidade WCAG 2.1 AA no Frontend

- [x] 6.1 Revisar `/dashboard` aplicando correções de acessibilidade (landmarks semânticos, cabeçalhos de tabela com `<th scope="col">` e foco visível `focus-visible:ring-2`), e verificar passagem dos testes em `apps/web/src/app/(protected)/dashboard/page.test.tsx`.
- [x] 6.2 Revisar `/automations` e `/automations/new` garantindo associação explícita de `<label htmlFor="...">` com inputs, indicação `aria-invalid` e `aria-describedby` para erros, e verificar passagem dos testes em `apps/web/src/app/(protected)/automations/new/page.test.tsx`.
- [x] 6.3 Revisar `/automations/[id]` assegurando gerenciamento de foco acessível no modal de exibição única da chave de API e redundância texto + cor + ícone nos badges, e verificar passagem de testes de componentes.
- [x] 6.4 Revisar `/incidents` e `/incidents/[id]` assegurando estrutura de timeline semântica com `role="region"`, contraste de cores em badges e focus trap com tecla Escape no `ResolveIncidentModal`, e verificar passagem dos testes em `apps/web/src/app/(protected)/incidents/[id]/page.test.tsx`.

## 7. Setup da Infraestrutura Playwright

- [x] 7.1 Instalar `@playwright/test` na raiz do monorepo e criar `playwright.config.ts` configurado com `webServer` para iniciar ou reutilizar a API (`http://localhost:3001/api/v1/health`) e o Web (`http://localhost:3000`), artefatos econômicos (`trace: on-first-retry`, `screenshot: only-on-failure`, `video: retain-on-failure`), e verificar validação da configuração do Playwright.
- [x] 7.2 Adicionar o script canônico `"test:e2e": "playwright test"` no `package.json` raiz e verificar que `npm run test:e2e -- --help` executa corretamente.
- [x] 7.3 Criar helper de mock determinístico do OpenRouter em `tests/e2e/helpers/openrouter-mock.ts` que inicia um servidor HTTP local na porta 3002 retornando resposta válida no schema de diagnóstico para `POST /chat/completions`, e verificar resposta com teste isolado.
- [x] 7.4 Criar script de autenticação E2E em `tests/e2e/auth.setup.ts` para autenticar o usuário via Clerk usando `E2E_CLERK_USER_EMAIL` e `E2E_CLERK_USER_PASSWORD` e salvar o estado de sessão em `playwright/.auth/user.json`.

## 8. E2E — Fluxo 1: Onboarding e Ativação de Automação

- [x] 8.1 Criar teste E2E `tests/e2e/flow1-automation-onboarding.spec.ts` validando o fluxo de login autenticado, navegação para `/automations/new`, preenchimento de nome, criticidade HIGH, duração e criação com sucesso.
- [x] 8.2 No teste E2E do Fluxo 1, validar clique em "Gerar Credencial", conferência de que o segredo `fp_live_...` é exibido uma única vez, cópia do valor estritamente em memória do teste sem gravação em disco.
- [x] 8.3 No teste E2E do Fluxo 1, enviar chamada de API `POST /api/v1/executions` com `is_test: true` utilizando a chave em memória, verificar na interface a transição para `VALIDATED`, clicar em "Ativar Monitoramento" e verificar o status `ACTIVE`.

## 9. E2E — Fluxo 2: Ciclo de Incidente e IA Consultiva

- [x] 9.1 Criar teste E2E `tests/e2e/flow2-incident-lifecycle.spec.ts` enviando execução produtiva com `status: FAILED` para automação ativa e verificando a criação de incidente com status `OPEN`.
- [x] 9.2 No teste E2E do Fluxo 2, localizar o incidente gerado na página `/incidents`, navegar até `/incidents/[id]`, clicar em "Assumir Incidente" e verificar a transição para `ACKNOWLEDGED`.
- [x] 9.3 No teste E2E do Fluxo 2, clicar em "Iniciar Investigação", verificar transição para `INVESTIGATING`, solicitar análise de IA contra o mock determinístico e verificar renderização do card com causas, evidências, recomendações e aviso consultivo.
- [x] 9.4 No teste E2E do Fluxo 2, acionar "Resolver Incidente", preencher notas explicativas com mais de 10 caracteres, confirmar submissão, verificar status `RESOLVED` e conferir a timeline de eventos contendo todos os marcos registrados.

## 10. Testes de Observabilidade e Não-Regressão

- [x] 10.1 Criar suíte de testes de observabilidade em `apps/api/test/observability.spec.ts` cobrindo geração de `X-Request-ID` quando ausente, preservação quando fornecido, presença de `X-Trace-ID` com span ativo e inclusão de ambos no body de erro RFC 7807.
- [x] 10.2 Criar teste automatizado garantindo que `JsonLoggerService` redige segredos e que nenhuma chave `fp_live_...` ou token sensível é impresso em logs mesmo quando interpolado em parâmetros.
- [x] 10.3 Validar que o endpoint `GET /api/v1/health` responde 200 OK sem depender de collector OTLP e sem expor detalhes sensíveis de infraestrutura.
- [x] 10.4 Executar teste de não-regressão do `OpenRouterService` garantindo que exceções e timeouts externos não interpolam mensagens brutas de erro de terceiros em logs.

## 11. Quality Gates e Verificação Final

- [x] 11.1 Executar suíte de testes unitários e de integração (`npm run test`) e verificar que todos os 186 testes existentes e novos testes passam com código de saída 0.
- [x] 11.2 Executar validação estática de tipos (`npm run typecheck`) em todos os workspaces e verificar zero erros.
- [x] 11.3 Executar linter e checagem de formatação (`npm run lint`) e verificar conformidade estrita com Prettier e ESLint.
- [x] 11.4 Executar compilação de todos os pacotes (`npm run build`) e verificar geração dos builds de `apps/api` e `apps/web`.
- [x] 11.5 Executar a suíte E2E Playwright (`npm run test:e2e`) e verificar que os testes dos Fluxos 1 e 2 passam integralmente.
- [x] 11.6 Validar arquivo Docker Compose com `docker compose config` e verificar ausência de erros de sintaxe ou variáveis indefinidas.
