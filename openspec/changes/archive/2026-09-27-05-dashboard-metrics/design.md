# Design: 05-dashboard-metrics

## Context

O FlowPulse possui entidades maduras persistidas no PostgreSQL (`User`, `Automation`, `ApiKey`, `Execution`, `Incident`, `IncidentEvent`, `AiAnalysis`). O volume de dados de execuções tende a crescer rapidamente à medida que automações integradas (n8n, Python, AWS Step Functions) enviam seus relatórios de execução (`POST /api/v1/executions`).

Atualmente, a rota `/dashboard` no frontend Next.js é apenas uma página estática de verificação de sessão e identidade criada na change 02. Para atender ao requisito **RF-07**, o dashboard precisa exibir uma visão consolidada e imediata da saúde das operações, com volume de execuções, falhas, taxa de sucesso, incidentes em aberto, tempo médio de reconhecimento (MTTA), tempo médio de resolução (MTTR) e os incidentes mais recentes que demandam triagem.

Todas as métricas devem ser calculadas de forma determinística sobre dados reais existentes, sem geração de dados sintéticos ou consulta a modelos de IA.

---

## Goals / Non-Goals

### Goals
- Disponibilizar o endpoint `GET /api/v1/dashboard/metrics?period=7d` consolidado e de baixa latência (< 200ms em bases padrão), protegido por RBAC (`ADMIN`, `ANALYST`);
- Permitir alternância de períodos operacionais (`24h`, `7d`, `30d`), garantindo consistência temporal em UTC;
- Executar agregações diretamente na camada de banco de dados (PostgreSQL/Prisma), evitando tráfego de dados massivo e processamento in-memory no Node.js;
- Preencher lacunas da série temporal no backend para prover linha contínua de visualização ao frontend;
- Implementar visualização acessível de gráficos no frontend (SVG/HTML responsivo) sem dependências externas pesadas (zero overhead de bundle com bibliotecas desnecessárias);
- Garantir acessibilidade plena WCAG 2.1 AA (contraste, foco por teclado, tripla codificação de status e severidade, rótulos ARIA);
- Adicionar índices incrementais no banco via Prisma Migrate dev para acelerar filtros temporais e de status sem perda de dados.

### Non-Goals
- Não utilizar materialização complexa ou materialized views pré-calculadas (a volumetria atual é atendida com índices B-Tree e agregações SQL eficientes);
- Não utilizar Redis ou caches distribuídos externos nesta etapa;
- Não chamar o provedor de IA (OpenRouter) para sínteses ou predições no dashboard;
- Não implementar notificações ativas ou disparos de webhook/Slack a partir do dashboard (pertencem a escopo posterior);
- Não implementar instrumentação OpenTelemetry ou tracing distribuído nesta change (pertencem à change 06);
- Não redesenhar o fluxo de autenticação nem a navegação raiz da aplicação.

---

## Decisions

### 1. Endpoint Único Agregado (`GET /api/v1/dashboard/metrics`)
- **Decisão:** Unificar todos os blocos de dados do dashboard em uma única chamada HTTP protegida (`ClerkAuthGuard`, `RolesGuard`), retornando o resumo (`summary`), a série temporal (`execution_series`), as distribuições (`incidents_by_status`, `open_incidents_by_severity`) e a lista (`recent_incidents`).
- **Rationale:** Elimina problemas de *waterfall* de requisições no frontend, reduz a sobrecarga de conexão e handshake TLS com o backend, e assegura que todos os dados do dashboard sejam congelados no mesmo instante de amostragem (`generated_at`).
- **Alternativas consideradas:**
  - *Múltiplos endpoints granulares (`/dashboard/summary`, `/dashboard/series`, etc.):* Rejeitado por aumentar a latência percebida do usuário e complexidade de orquestração no frontend.
  - *GraphQL:* Rejeitado por violar a convenção RESTful RFC 7807 adotada no FlowPulse.

### 2. Agregação Direta no PostgreSQL vs Agregação em Memória
- **Decisão:** Todas as contagens, agrupamentos por bucket temporal e médias ponderadas de tempo (MTTA/MTTR) serão executadas diretamente pelo PostgreSQL utilizando Prisma Client e consultas parametrizadas `$queryRaw` quando funções SQL nativas (`date_trunc`, `EXTRACT(EPOCH FROM ...)`, `FILTER (WHERE ...)`) forem necessárias.
- **Rationale:** Trazer dezenas de milhares de instâncias de `Execution` para a memória do Node.js através de `findMany` causaria alto consumo de RAM, saturação de garbage collection e latências inaceitáveis. O PostgreSQL realiza agrupamentos indexados em milissegundos.
- **Alternativas consideradas:**
  - *`findMany` com `reduce` no TypeScript:* Rejeitado por ser um anti-padrão de performance com risco evidente de Out Of Memory (OOM).

### 3. Fórmulas Exatas e Tratamento de Casos de Borda

#### Taxa de Sucesso (`success_rate`):
$$\text{success\_rate} = \frac{\text{total}(SUCCESS)}{\text{total}(SUCCESS) + \text{total}(FAILED) + \text{total}(TIMEOUT)} \times 100$$
- `RUNNING` é excluído do denominador por se tratar de estado transitório inconcluso.
- Caso o denominador seja igual a zero: retorna `null` (evitando `0%` falso ou `NaN`/`Infinity`).

#### MTTA (`mtta_seconds`):
- Média aritmética de `EXTRACT(EPOCH FROM (acknowledged_at - opened_at))` para incidentes com `opened_at >= start_time` E `acknowledged_at IS NOT NULL`.
- Incidentes não assumidos (`acknowledged_at IS NULL`) **NÃO** entram no cálculo e **NÃO** contam como zero.
- Caso não haja incidentes elegíveis: retorna `null`.

#### MTTR (`mttr_seconds`):
- Média aritmética de `EXTRACT(EPOCH FROM (resolved_at - opened_at))` para incidentes com `opened_at >= start_time` E `resolved_at IS NOT NULL`.
- Incidentes pendentes (`resolved_at IS NULL`) **NÃO** entram no cálculo e **NÃO** contam como zero.
- Caso não haja incidentes elegíveis: retorna `null`.

#### Backlog Ativo vs Distribuição de Status:
- `open_incidents`: soma de incidentes com `status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')` no momento atual (estado global).
- `incidents_by_status`: contagem atual global de todos os status (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`).
- `open_incidents_by_severity`: contagem restrita a incidentes com `status != 'RESOLVED'`, pois reflete a carga de trabalho imediata que compete por atenção do analista.

### 4. Série Temporal Contínua com Preenchimento de Lacunas (Gap Filling)
- **Decisão:** O backend executará agrupamento temporal via SQL (`date_trunc('hour', ...)` para `24h` e `date_trunc('day', ...)` para `7d` e `30d`) e, em seguida, preencherá deterministicamente no `DashboardService` os intervalos que não tiveram execuções com contadores zerados (`total: 0, success: 0, failed: 0, timeout: 0`).
- **Rationale:** Séries com buracos temporais produzem gráficos truncados ou visualmente enganosos. O preenchimento no backend centraliza essa regra e alivia o cliente de manipular fusos horários e datas complexas.

### 5. Renderização Gráfica Acessível e Leve no Frontend
- **Decisão:** Utilizar barras empilhadas e componentes visuais nativos em SVG e classes utilitárias do Tailwind CSS, sem introduzir dependências de terceiros (como Recharts, Chart.js ou Highcharts).
- **Rationale:** Mantém o tamanho do pacote do Next.js extremamente enxuto, permite estilização pixel-perfect com o design system do FlowPulse, e facilita a implementação de conformidade WCAG 2.1 AA (legendas textuais, padrões visuais além de cor, tooltips acessíveis via teclado e atributos ARIA).

### 6. Índices Incrementais no Banco de Dados
- **Decisão:** Criar migration versionada incremental (`prisma migrate dev`) contendo:
  - Tabela `executions`: `CREATE INDEX idx_executions_created_at_status ON executions(created_at, status);`
  - Tabela `incidents`: `CREATE INDEX idx_incidents_opened_at_status ON incidents(opened_at, status);`
- **Rationale:** Acelera significativamente os filtros por janela temporal (`created_at >= start_time` e `opened_at >= start_time`) combinados com agregações por status.

---

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Crescimento acentuado de execuções causando lentidão na query de série temporal | Latência do endpoint ultrapassar 500ms sob grande carga | Criação do índice composto `(created_at, status)` e uso de `date_trunc` com filtro indexado no PostgreSQL. |
| Inconsistência de fuso horário entre cliente e servidor | Agrupamento de buckets desalinhado com a data local do usuário | Todo cálculo e persistência são estritamente mantidos em UTC. O backend retorna timestamps ISO 8601 em UTC (`Z`) e o frontend formata para o fuso local do navegador na exibição. |
| Exibição de valores `NaN` ou `Infinity` quando métricas não têm amostras | Má impressão do usuário e quebra visual | Contrato tipado da API retornando explicitamente `number | null`. Componentes de frontend tratam `null` renderizando travessão (`—`) e legendas explicativas. |
| Transições de período gerando requisições duplicadas ou loops | Consumo desnecessário de CPU no backend | Controle no frontend com desativação de clique no período ativo e debounce/sincronização via Next.js App Router navigation. |

---

## Migration Plan

1. **Schema Prisma:**
   - Adicionar os índices `@@index([created_at, status])` em `Execution` e `@@index([opened_at, status])` em `Incident`;
   - Executar `npx prisma migrate dev --name add_dashboard_indexes`;
   - Executar `npx prisma generate` para sincronização do client.
2. **Backend:**
   - Criar módulo `DashboardModule`, `DashboardController`, `DashboardService`, DTOs de entrada e saída;
   - Registrar `DashboardModule` no `AppModule`.
3. **Frontend:**
   - Atualizar a página `apps/web/src/app/(protected)/dashboard/page.tsx` para carregar dados de `GET /api/v1/dashboard/metrics`;
   - Implementar componentes `DashboardMetricsCards`, `ExecutionSeriesChart`, `IncidentsDistribution` e `RecentIncidentsTable`.
4. **Rollback Strategy:**
   - Como nenhuma coluna ou tabela existente é modificada ou excluída, o rollback de código consiste apenas em reverter os commits de código, mantendo os índices (que não causam quebra).

---

## Open Questions

- *Nenhuma questão em aberto.* Todos os critérios de negócio, fórmulas matemáticas, períodos e contratos de API foram plenamente especificados e acordados.
