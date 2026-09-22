# Proposal: 06-observability-quality

## Objetivo

Elevar a plataforma ao nível de produção em termos de observabilidade, rastreabilidade, acessibilidade e qualidade: instrumentação OpenTelemetry completa, logs JSON estruturados com correlação, auditoria complementar, testes E2E Playwright dos dois fluxos centrais e quality gates aplicados ao CI local.

Este change **não concentra testes que deveriam existir nos changes anteriores**. Cada change já entregou seus testes unitários e de integração. Aqui o foco é cobertura E2E ponta a ponta, instrumentação de observabilidade e quality gates formalizados.

---

## Escopo

### Incluído

**Backend (apps/api) — OpenTelemetry**
- Inicialização do SDK OpenTelemetry antes dos módulos NestJS (`tracing.ts` carregado via `--require`)
- Traces automáticos para: requisições HTTP/REST, queries Prisma ORM, chamadas HTTPS externas ao OpenRouter e ao Clerk JWKS
- Propagação de contexto via header `traceparent` (W3C Trace Context)
- Middleware global garantindo que toda requisição tenha `request_id` (UUID v4, gerado ou herdado do header `X-Request-ID`) e `trace_id` (extraído do span ativo do OTel)
- Exportação de telemetria para OpenTelemetry Collector (configurado via `OTEL_EXPORTER_OTLP_ENDPOINT`)

**Backend (apps/api) — Logs Estruturados em JSON**
- Substituição do logger padrão do NestJS por logger JSON (Pino ou equivalente)
- Campos obrigatórios em todo log: `timestamp`, `level`, `service`, `environment`, `trace_id`, `request_id`, `event_name`
- Campos sensíveis (tokens, senhas, PII) nunca aparecem em logs — validação por revisão de código e testes de sanitização

**Backend (apps/api) — Auditoria Complementar**
- Revisão e preenchimento de eventuais gaps de `audit_logs` identificados nos changes anteriores
- Garantia de que todas as operações críticas estão cobertas: cadastro de automação, geração e revogação de chave, ativação de automação, assumir incidente, transições de status, análise de IA solicitada, resolução de incidente

**Frontend (apps/web) — Acessibilidade**
- Auditoria WCAG 2.1 AA nas páginas principais: `/dashboard`, `/automations`, `/incidents`, `/incidents/{id}`
- Garantia de: foco visível em todos os elementos interativos, navegação completa por teclado, indicadores de status com texto + cor + ícone, contraste mínimo 4.5:1, textos alternativos em imagens e ícones

**Testes E2E — Playwright**
- Configuração do projeto Playwright em `tests/e2e/`
- **FLUXO 1 E2E:**
  1. Login ADMIN via Clerk (mock de sessão ou conta de teste)
  2. Criação de automação com criticidade HIGH e duração esperada
  3. Geração de credencial (`fp_live_...` exibido, copiado)
  4. Envio de execução de teste via `POST /api/v1/executions` com `is_test: true`
  5. Ativação do monitoramento
  6. Verificação: automação em status ACTIVE na interface
- **FLUXO 2 E2E:**
  1. Envio de execução com `status: failed` para automação ACTIVE
  2. Verificação: incidente OPEN aparece na fila
  3. Analista assume o incidente (ACKNOWLEDGED)
  4. Analista inicia investigação (INVESTIGATING)
  5. Solicita análise de IA (mock do OpenRouter retornando análise estruturada válida)
  6. Card de análise exibido com aviso consultivo
  7. Analista registra resolução com `resolution_notes`
  8. Verificação: incidente em status RESOLVED, timestamps e audit trail presentes

**Quality Gates (locais)**
- Documentação e execução verificada dos gates:
  ```bash
  npm run test && npm run typecheck && npm run lint && npm run build
  ```
- `npm run test:e2e` executando os dois fluxos Playwright sem erros
- Verificação de que nenhuma variável de ambiente secreta aparece nos logs de CI

### Excluído

- Testes unitários e de integração dos módulos dos changes 01–05 (já entregues nos respectivos changes)
- Configuração de alertas ou dashboards no OpenTelemetry Collector (infraestrutura externa)
- Análise de cobertura de código (pode ser adicionada como melhoria futura)

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| — | — | Nenhuma nova migration. Ajustes de auditoria são operacionais (dados, não schema). |

---

## Critério de Conclusão

```bash
npm run test          # todos os testes unitários e de integração do projeto passando
npm run test:e2e      # Playwright: Fluxo 1 e Fluxo 2 passando
npm run typecheck     # sem erros
npm run lint          # sem erros
npm run build         # sem erros
```

**Verificações adicionais:**
- `GET /api/v1/health` (ou qualquer endpoint) retorna header `X-Request-ID` e `X-Trace-ID` preenchidos
- Logs emitidos em JSON válido (verificar amostra manual em ambiente de desenvolvimento)
- Playwright: ambos os fluxos executam do início ao fim sem intervenção manual

---

## Não-objetivos

- Substituir testes unitários/integração dos changes anteriores
- Configurar plataforma de observabilidade em produção (Grafana, Jaeger etc.) — responsabilidade do change 07 / operação
- Análise de cobertura percentual de código

---

## Dependências

- `05-dashboard-metrics` (todos os módulos implementados e com testes básicos passando)

---

## Referências

- `@docs/spec.md` — Seção 9 (Observabilidade e Rastreabilidade), Seção 10 (Critérios Técnicos)
- `@docs/architecture.md` — OpenTelemetry, Logs Estruturados, Pirâmide de Testes, Qualidade e Estratégia de Testes
- `@docs/prd.md` — RNF-01 (Acessibilidade WCAG 2.1 AA), RNF-04 (Observabilidade), RNF-05 (Manutenibilidade)
- `@AGENTS.md` — Seção 7 (Critério de Conclusão), regra de test:e2e obrigatório para Fluxos 1 e 2
