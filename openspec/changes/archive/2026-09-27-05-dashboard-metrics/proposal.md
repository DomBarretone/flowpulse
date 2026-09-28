# Proposal: 05-dashboard-metrics

## Why

O FlowPulse consolidou nas changes anteriores a fundação técnica (`01-project-foundation`), o controle de acesso e identidade via Clerk e RBAC (`02-auth-rbac`), a ingestão resiliente de execuções com geração automática de incidentes (`03-automation-integration`) e o ciclo completo de tratamento de incidentes com análise assistida por IA (`04-incident-lifecycle-ai`).

No entanto, a rota `/dashboard` no frontend Next.js permanece como uma tela provisória de verificação de identidade e credenciais de acesso, sem exibir informações operacionais reais das automações monitoradas.

Esta change transforma `/dashboard` em um painel operacional completo, ágil e focado na tomada de decisão de engenheiros e analistas de suporte (`ADMIN` e `ANALYST`), atendendo ao requisito **RF-07** do PRD e às métricas operacionais essenciais do FlowPulse (MTTA, MTTR, taxa de sucesso e volume temporal de execuções), utilizando exclusivamente os dados persistidos no PostgreSQL via Prisma ORM, sem recorrer a métricas simuladas ou chamadas custosas ao modelo de IA.

## What Changes

### 1. Backend (`apps/api`) — Módulo de Métricas e Agregações (`DashboardModule`)
- **Novo Endpoint REST Unificado:** `GET /api/v1/dashboard/metrics?period=7d`
  - Protegido por `ClerkAuthGuard` e `RolesGuard` para papéis `ADMIN` e `ANALYST`.
  - Suporte aos períodos padronizados `period=24h`, `period=7d` e `period=30d` (default: `7d`).
  - Validação estrita via `ValidationPipe` retornando `422 Unprocessable Entity` (RFC 7807) para períodos inválidos.
  - Resposta unificada e agregada contendo resumo de indicadores, série temporal de execuções, distribuição de incidentes por status e severidade, e incidentes recentes prioritários.
- **Cálculo de Indicadores Operacionais (Summary):**
  - `active_automations`: total de automações com `Automation.status === ACTIVE` (estado atual global, independente de período).
  - `executions`: contagem de execuções criadas dentro da janela temporal selecionada (`Execution.created_at >= start_time`).
  - `success_rate`: percentual de execuções com status `SUCCESS` sobre o total de execuções finalizadas relevantes (`SUCCESS + FAILED + TIMEOUT`). Execuções em `RUNNING` não entram no cálculo. Caso o total concluído seja zero, retorna `null` (evitando divisões por zero ou valores `NaN`/`Infinity`).
  - `failures`: total de execuções no período com status `FAILED` ou `TIMEOUT`.
  - `open_incidents`: total de incidentes ativos no backlog (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`), excluindo `RESOLVED`.
  - `mtta_seconds`: Mean Time To Acknowledge, computado pela média de `acknowledged_at - opened_at` para incidentes cujo `opened_at` está no período e possuem `acknowledged_at` não nulo. Retornado em segundos na API. Caso não haja incidentes elegíveis, retorna `null` (nunca zero para incidentes não reconhecidos).
  - `mttr_seconds`: Mean Time To Resolve, computado pela média de `resolved_at - opened_at` para incidentes cujo `opened_at` está no período e possuem `resolved_at` não nulo. Retornado em segundos na API. Caso não haja incidentes elegíveis, retorna `null` (nunca zero para incidentes não resolvidos).
- **Série Temporal de Execuções (`execution_series`):**
  - Agrupamento temporal no PostgreSQL (`date_trunc`): por hora para `period=24h` e por dia para `period=7d` e `period=30d`.
  - Estrutura de cada bucket: `timestamp` (ISO 8601 UTC), `total`, `success`, `failed`, `timeout`.
  - Preenchimento determinístico no backend de buckets sem execuções com valor `0` para assegurar continuidade visual no gráfico sem descontinuidade na timeline.
- **Distribuição de Incidentes:**
  - `incidents_by_status`: contagem do estado atual global em `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING` e `RESOLVED`.
  - `open_incidents_by_severity`: contagem restrita a incidentes não resolvidos (`status != RESOLVED`) por severidade: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **Fila de Incidentes Recentes Prioritários (`recent_incidents`):**
  - Consulta aos 5 incidentes mais críticos com ordenação: (1) não resolvidos primeiro, (2) maior severidade primeiro (`CRITICAL > HIGH > MEDIUM > LOW`), (3) `opened_at` mais recente.
  - Campos expostos: `id`, `status`, `severity`, dados da automação (`id`, `name`), `opened_at` e dados do responsável atribuído (`id`, `name`, `email` ou `null`).
- **Otimizações de Banco e Índices:**
  - Agregações realizadas no banco via queries SQL parametrizadas / Prisma nativo, evitando carregar grandes volumes de registros para a memória da aplicação.
  - Migration incremental Prisma adicionando índices compostos dedicados para filtros de data e status (`executions(created_at, status)` e `incidents(opened_at, status)`).

### 2. Frontend (`apps/web`) — Painel Operacional Acessível (`/dashboard`)
- Substituição da página atual de credenciais por um dashboard operacional com alta hierarquia de informação e paleta dark do FlowPulse.
- **Cabeçalho e Controles:**
  - Título do dashboard, contexto operacional e seletor de períodos (24h, 7d, 30d).
  - Persistência do período via query parameter na URL (`?period=24h`) com recarregamento reativo e prevenção de requisições duplicadas.
- **Cards de Métricas:**
  - 7 cards principais: Automações Ativas, Execuções no Período, Taxa de Sucesso, Falhas, Incidentes Abertos, MTTA e MTTR.
  - Formatação amigável de tempo para MTTA e MTTR (ex: `45s`, `3m 20s`, `1h 12m`).
  - Tratamento visual explícito para valores nulos (`—`) sem nunca exibir `NaN`, `Infinity` ou `undefined`.
- **Visualização da Série Temporal (Gráfico de Execuções):**
  - Componente gráfico nativo e acessível (SVG/HTML sem dependência de bibliotecas pesadas), ilustrando o volume de execuções com separação de Sucesso, Falhas e Timeouts.
  - Acessibilidade WCAG 2.1 AA: legenda interativa, tooltips com dados precisos, contraste visual e dupla codificação sem depender apenas de cores.
- **Distribuição Visual de Incidentes:**
  - Barras horizontais para distribuição por status (visão geral do backlog e resoluções).
  - Barras horizontais para distribuição por severidade dos incidentes abertos (foco na carga operacional de alta criticidade).
- **Tabela de Incidentes Recentes:**
  - Listagem dos 5 incidentes prioritários com badges semânticas (texto + cor + ícone), indicação de tempo relativo e link direto para `/incidents/:id`.
- **Resiliência e Estados da UI:**
  - Skeleton screens em loading.
  - Empty states informativos quando não houver registros no período.
  - Tratamento de falhas RFC 7807 com mensagem amigável e botão de retentativa.

## Capabilities

### New Capabilities
- `dashboard-metrics`: Serviço backend e endpoint REST (`GET /api/v1/dashboard/metrics`) fornecendo métricas operacionais consolidadas, agregações temporais, MTTA, MTTR, distribuições e incidentes prioritários.
- `dashboard-ui`: Painel operacional no frontend Next.js (`apps/web`) em `/dashboard`, com cards de métricas, seletor de período, gráfico de volume temporal de execuções acessível, distribuições de incidentes e atalhos contextuais.

### Modified Capabilities
<!-- Nenhuma capability existente tem seus requisitos modificados nesta change. As capacidades de automação, ciclo de vida de incidentes e autenticação permanecem estáveis. -->

## Impact

- **APIs e Contratos:** Adição do endpoint `GET /api/v1/dashboard/metrics`. Nenhuma alteração retroativa em endpoints existentes de `/api/v1/automations`, `/api/v1/executions` ou `/api/v1/incidents`.
- **Banco de Dados (PostgreSQL / Supabase):** Nenhuma alteração destrutiva em tabelas. Adição de índices recomendados via migration versionada Prisma (`prisma migrate dev`) para otimização de consultas por intervalo temporal e status.
- **Frontend:** Atualização da página `/dashboard` no layout autenticado `(protected)`. Componentes existentes de navegação, badge e autenticação permanecem inalterados.
- **Dependências Externas:** Zero novas dependências de pacotes pesados no frontend ou backend; cálculos executados nativamente no PostgreSQL e gráficos renderizados com SVG/CSS responsivo e semântico.
