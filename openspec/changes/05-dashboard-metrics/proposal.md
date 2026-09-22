# Proposal: 05-dashboard-metrics

## Objetivo

Implementar o dashboard operacional com visão consolidada das automações, cálculo de métricas MTTA e MTTR, resumo de incidentes por status e severidade, e filtros temporais — entregando o requisito RF-07 e os indicadores de produto definidos no PRD.

---

## Escopo

### Incluído

**Backend (apps/api) — DashboardModule**
- `GET /api/v1/dashboard/summary` — endpoint de indicadores operacionais agregados (ADMIN, ANALYST):
  - `total_executions`: total de execuções no período
  - `success_rate`: percentual de execuções com status `SUCCESS`
  - `failure_count`: total de execuções `FAILED` + `TIMEOUT`
  - `open_incidents`: total de incidentes com status `OPEN` ou `ACKNOWLEDGED` ou `INVESTIGATING`
  - `critical_incidents`: total de incidentes com `severity === CRITICAL` e status não `RESOLVED`
  - `mtta_seconds_avg`: média de `acknowledged_at - created_at` para incidentes com `acknowledged_at` preenchido no período
  - `mttr_seconds_avg`: média de `resolved_at - created_at` para incidentes `RESOLVED` no período
- Suporte a filtro por período (`from`, `to` em ISO 8601) como query params
- Cálculo realizado com queries Prisma agregadas (sem lógica de negócio no frontend)
- Respostas em cache leve via `Cache-Control: max-age=30` (sem Redis, apenas header HTTP)

**Backend (apps/api) — Filtros e Consultas Avançadas**
- `GET /api/v1/incidents` — extensão: filtros por `from`, `to` (período), suporte a paginação com `cursor` ou `page`/`limit`
- `GET /api/v1/executions` — extensão: filtros por `from`, `to` (período)

**Frontend (apps/web)**
- Página `/dashboard` com cards de indicadores:
  - Total de execuções (período selecionável)
  - Taxa de sucesso (percentual + tendência visual)
  - Incidentes abertos (count com breakdown por severidade)
  - Incidentes críticos (count em destaque)
  - MTTA médio (formatado em minutos/horas)
  - MTTR médio (formatado em minutos/horas)
- Seletor de período (últimas 24h, 7 dias, 30 dias, intervalo customizado)
- Lista de incidentes recentes com link para detalhe
- Navegação lateral com links para `/automations`, `/executions`, `/incidents`
- Acessibilidade WCAG 2.1 AA: status combinando texto + cor + ícone em todos os cards e listas

### Excluído

- Gráficos temporais (chart de séries temporais) — pode ser considerado em versão futura
- Alertas configuráveis — versão 1.0
- Exportação de dados (CSV, PDF) — fora do MVP
- Redis ou cache distribuído para os indicadores

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| — | — | Nenhuma nova entidade. Os cálculos de MTTA/MTTR usam `acknowledged_at` e `resolved_at` já existentes em `incidents`. |

---

## Contratos de API

| Método | Rota | Auth | Papel | Descrição |
|--------|------|------|-------|-----------|
| `GET` | `/api/v1/dashboard/summary` | Clerk JWT | ADMIN, ANALYST | Indicadores operacionais agregados |

Query params suportados: `from` (ISO 8601), `to` (ISO 8601).

---

## Critério de Conclusão

```bash
npm run test          # testes unitários e de integração deste change passando
npm run typecheck     # sem erros
npm run lint          # sem erros
npm run build         # sem erros
```

**Testes unitários:**
- `DashboardService.computeMTTA()`: incidentes sem `acknowledged_at` não contam na média; média calculada corretamente sobre o conjunto com valor preenchido
- `DashboardService.computeMTTR()`: incidentes sem `resolved_at` não contam; cálculo correto sobre `RESOLVED`
- `DashboardService.getSummary()`: filtro de período é aplicado a todas as queries (execuções e incidentes)
- Cálculo de `success_rate`: zero execuções no período retorna `null` (não divisão por zero)

**Testes de integração (Supertest):**
- `GET /api/v1/dashboard/summary` sem autenticação → 401
- `GET /api/v1/dashboard/summary` com ANALYST → 200 com estrutura completa dos indicadores
- `GET /api/v1/dashboard/summary?from=2026-01-01&to=2026-01-31` → indicadores restritos ao período
- Consistência: `open_incidents` bate com count real de `GET /api/v1/incidents?status=OPEN`

---

## Não-objetivos

- Gráficos com séries temporais
- Alertas ou notificações a partir dos indicadores
- Cache distribuído

---

## Dependências

- `04-incident-lifecycle-ai` (campos `acknowledged_at`, `resolved_at`, `resolution_notes` em `incidents`, entidades `ai_analyses` estáveis)

---

## Referências

- `@docs/prd.md` — RF-07 (Dashboard e indicadores), Métricas de Produto e de Operação
- `@docs/spec.md` — Seção 6 (GET /api/v1/dashboard/summary), RF-10 (Consulta e filtros)
- `@docs/architecture.md` — Adequação Funcional (Fonte Única da Verdade)
