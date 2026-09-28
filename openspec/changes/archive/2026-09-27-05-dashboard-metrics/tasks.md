# Tasks: 05-dashboard-metrics

## 1. Database & Indexing

- [x] 1.1 Atualizar `schema.prisma` com índices compostos para filtros temporais e status (`Execution(created_at, status)` e `Incident(opened_at, status)`), gerando a migration incremental com `npx prisma migrate dev --name add_dashboard_indexes` e validando com `npx prisma generate`

## 2. Backend DTOs & Contracts

- [x] 2.1 Criar `QueryDashboardMetricsDto` com validação de enum `period` (`24h`, `7d`, `30d`, default `7d`) via `class-validator` e `class-transformer`, verificando que valores inválidos são rejeitados com `422 Unprocessable Entity`
- [x] 2.2 Criar DTOs de resposta tipados (`DashboardMetricsResponseDto`, `DashboardSummaryDto`, `ExecutionSeriesBucketDto`, `IncidentsByStatusDto`, `OpenIncidentsBySeverityDto`, `RecentIncidentItemDto`) com decorators do `@nestjs/swagger`

## 3. Backend Service & Aggregations

- [x] 3.1 Implementar `DashboardService` com cálculo determinístico de janelas de tempo em UTC para `24h`, `7d` e `30d`, verificando limites temporais com testes unitários
- [x] 3.2 Implementar agregações de contagem no `DashboardService` para `active_automations`, `executions`, `failures` e `open_incidents` utilizando consultas otimizadas no PostgreSQL
- [x] 3.3 Implementar cálculo de `success_rate` com exclusão de `RUNNING` e retorno de `null` quando o denominador for zero, validando com testes unitários
- [x] 3.4 Implementar cálculo de `mtta_seconds` e `mttr_seconds` considerando apenas incidentes abertos no período com timestamps de reconhecimento/resolução não nulos, retornando `null` quando não houver amostras elegíveis
- [x] 3.5 Implementar série temporal `execution_series` com agrupamento por hora (`24h`) e dia (`7d`, `30d`) e preenchimento determinístico de intervalos vazios com zero (gap filling contínuo)
- [x] 3.6 Implementar distribuições `incidents_by_status` (contagem global) e `open_incidents_by_severity` (apenas não resolvidos), além da consulta ordenada de até 5 `recent_incidents`

## 4. Backend Controller & Module Setup

- [x] 4.1 Criar `DashboardController` expondo `GET /api/v1/dashboard/metrics` protegido por `ClerkAuthGuard`, `RolesGuard` e `@Roles(Role.ADMIN, Role.ANALYST)`
- [x] 4.2 Criar `DashboardModule`, registrar `DashboardController` e `DashboardService`, e importar o módulo em `AppModule` em `apps/api/src/app.module.ts`

## 5. Backend Testing & Verification

- [x] 5.1 Implementar suíte de testes unitários para `DashboardService` em `dashboard.service.spec.ts` cobrindo períodos, taxas, denominador zero, MTTA/MTTR nulos e ordenação de incidentes, executando com `npm run test`
- [x] 5.2 Implementar testes de integração Supertest para `GET /api/v1/dashboard/metrics` em `dashboard.e2e-spec.ts` validando 401 sem auth, 200 para ADMIN e ANALYST, 422 para período inválido e integridade do contrato JSON

## 6. Frontend Components & Visualizations

- [x] 6.1 Criar componente `DashboardMetricsCards` em `apps/web` renderizando os 7 cards com formatação amigável de tempo (s, m, h) para MTTA/MTTR e travessão (`—`) para valores `null`
- [x] 6.2 Criar componente de série temporal `ExecutionSeriesChart` utilizando SVG e Tailwind CSS com dupla codificação acessível (texto + padrão/cor), legendas e tooltips descritivas
- [x] 6.3 Criar componentes de distribuição `IncidentStatusDistribution` e `IncidentSeverityDistribution` utilizando barras horizontais proporcionais e rótulos semânticos
- [x] 6.4 Criar componente `RecentIncidentsTable` exibindo até 5 incidentes com badges triplamente codificadas (texto + cor + ícone) e links de navegação para `/incidents/:id`

## 7. Frontend Page Integration & UI States

- [x] 7.1 Atualizar `apps/web/src/app/(protected)/dashboard/page.tsx` para consumir `GET /api/v1/dashboard/metrics` via API REST com token JWT do Clerk
- [x] 7.2 Implementar seletor de períodos (`24h`, `7d`, `30d`) com sincronização na URL (`?period=...`), navegação suave sem recarga completa e bloqueio de cliques repetidos
- [x] 7.3 Implementar estados visuais de loading com skeleton screens estruturados, empty states para ausência de registros e alerta de erro RFC 7807 com botão de retentativa

## 8. Frontend Testing & Quality Verification

- [x] 8.1 Implementar testes unitários e de renderização para o dashboard em `apps/web/src/app/(protected)/dashboard/page.test.tsx` cobrindo cards, períodos, série temporal, tratamento de nulos e links
- [x] 8.2 Executar quality gates globais (`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`) garantindo zero erros e zero advertências
