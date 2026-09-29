# dashboard-metrics Specification

## Purpose

Define os requisitos normativos para o serviço de métricas operacionais e endpoint REST consolidado no backend NestJS (`apps/api`), fornecendo agregações temporais eficientes sobre execuções e automações, cálculo determinístico de indicadores-chave de desempenho (MTTA, MTTR, taxa de sucesso) e distribuição categorizada de incidentes exclusivamente a partir de dados persistidos no PostgreSQL.

## Requirements

### Requirement: Endpoint REST consolidado de métricas operacionais
O backend NestJS SHALL disponibilizar a rota `GET /api/v1/dashboard/metrics` protegida por autenticação via Clerk e RBAC para os papéis `ADMIN` e `ANALYST`:
1. **Controle de Acesso:**
   - Requisições sem token JWT válido do Clerk SHALL ser rejeitadas com status HTTP `401 Unauthorized`;
   - Requisições autenticadas com papéis diferentes de `ADMIN` e `ANALYST` SHALL ser rejeitadas com status HTTP `403 Forbidden`;
   - Requisições de usuários com papéis `ADMIN` ou `ANALYST` SHALL receber resposta com status HTTP `200 OK`.
2. **Formato de Resposta Unificada:**
   - A resposta SHALL conter uma estrutura agregada única no formato JSON contendo as propriedades raiz `period`, `generated_at`, `summary`, `execution_series`, `incidents_by_status`, `open_incidents_by_severity` e `recent_incidents`;
   - O campo `generated_at` SHALL conter timestamp em formato ISO 8601 em UTC.

#### Scenario: Analista autenticado consulta métricas com sucesso
- **GIVEN** um usuário autenticado com papel `ANALYST`
- **WHEN** envia requisição `GET /api/v1/dashboard/metrics`
- **THEN** o sistema responde com status HTTP 200 e payload contendo todos os blocos consolidados de métricas e `period` padrão `7d`

#### Scenario: Requisição sem autenticação é rejeitada
- **GIVEN** uma requisição sem cabeçalho `Authorization`
- **WHEN** envia `GET /api/v1/dashboard/metrics`
- **THEN** o sistema responde com status HTTP 401 no padrão RFC 7807

### Requirement: Suporte e validação de janelas temporais de consulta
O endpoint `GET /api/v1/dashboard/metrics` SHALL suportar a seleção de períodos de análise através do parâmetro de consulta `period`:
1. **Valores Permitidos:** O parâmetro `period` SHALL aceitar estritamente os valores `'24h'`, `'7d'` e `'30d'`;
2. **Valor Padrão:** Caso o parâmetro `period` seja omitido na requisição, o sistema SHALL assumir deterministicamente `'7d'`;
3. **Validação Estrita:** Caso seja fornecido um valor diferente dos permitidos (ex: `period=15d` ou `period=all`), o sistema SHALL rejeitar a requisição com status HTTP `422 Unprocessable Entity` seguindo a especificação RFC 7807;
4. **Cálculo de Limites:** O cálculo do intervalo temporal inicial (`start_time`) SHALL ser determinado a partir do timestamp UTC atual (`now()`) subtraindo 24 horas, 7 dias ou 30 dias respectivamente, utilizando o banco de dados em UTC.

#### Scenario: Aplicação de período válido de 24 horas
- **GIVEN** um usuário autenticado
- **WHEN** envia requisição `GET /api/v1/dashboard/metrics?period=24h`
- **THEN** o sistema processa as métricas considerando a janela temporal das últimas 24 horas a partir do momento atual e retorna `period: "24h"` no payload

#### Scenario: Rejeição de período não reconhecido
- **GIVEN** um usuário autenticado
- **WHEN** envia requisição `GET /api/v1/dashboard/metrics?period=invalid_period`
- **THEN** o sistema responde com status HTTP 422 Problem Details indicando o erro de validação no parâmetro `period`

### Requirement: Resumo operacional e cálculo de taxas de execução
O objeto `summary` retornado pelo endpoint SHALL conter os indicadores fundamentais de volume e confiabilidade operacional:
1. `active_automations`: Quantidade total de automações com `status === 'ACTIVE'` no banco de dados, representando o estado cadastral atual e independente do período selecionado;
2. `executions`: Quantidade total de registros na tabela `executions` com `created_at` maior ou igual a `start_time` do período selecionado;
3. `failures`: Quantidade de execuções dentro do período cujo `status` seja igual a `'FAILED'` ou `'TIMEOUT'`;
4. `open_incidents`: Quantidade total de incidentes cujo `status` atual seja `'OPEN'`, `'ACKNOWLEDGED'` ou `'INVESTIGATING'` (excluindo `'RESOLVED'`), representando o backlog ativo atual;
5. `success_rate`: Percentual calculado pela fórmula:
   $$\text{success\_rate} = \frac{\text{count}(status = 'SUCCESS')}{\text{count}(status \in ['SUCCESS', 'FAILED', 'TIMEOUT'])} \times 100$$
   - Execuções com `status === 'RUNNING'` SHALL ser desconsideradas do cálculo da taxa;
   - Se o número total de execuções concluídas elegíveis no período for zero, `success_rate` SHALL retornar `null` (nunca `0`, `NaN` ou `Infinity`);
   - Quando numérico, o valor SHALL ser retornado arredondado com até 2 casas decimais.

#### Scenario: Cálculo de taxa de sucesso com execuções concluídas
- **GIVEN** 80 execuções `SUCCESS`, 15 `FAILED`, 5 `TIMEOUT` e 10 `RUNNING` no período de 7 dias
- **WHEN** o endpoint processa as métricas para `period=7d`
- **THEN** o objeto `summary` apresenta `executions: 110`, `failures: 20` e `success_rate: 80.0`

#### Scenario: Cálculo de taxa de sucesso em período sem execuções
- **GIVEN** nenhuma execução cadastrada no período selecionado
- **WHEN** o endpoint processa as métricas
- **THEN** o objeto `summary` apresenta `executions: 0`, `failures: 0` e `success_rate: null`

### Requirement: Cálculo determinístico do indicador MTTA (Mean Time To Acknowledge)
O sistema SHALL calcular o tempo médio de reconhecimento de incidentes no campo `mtta_seconds`:
1. **Critério de Elegibilidade:** SHALL ser considerados exclusivamente os incidentes da tabela `incidents` cujo campo `opened_at` esteja dentro da janela temporal selecionada (`opened_at >= start_time`) E cujo campo `acknowledged_at` seja não nulo;
2. **Cálculo da Média:** Para cada incidente elegível, computa-se a diferença em segundos entre `acknowledged_at` e `opened_at`. O `mtta_seconds` será a média aritmética desses valores;
3. **Ausência de Incidentes Elegíveis:** Se não houver nenhum incidente com `acknowledged_at` preenchido dentro do período, o sistema SHALL retornar `null`;
4. **Preservação de Semântica:** Incidentes abertos mas ainda não assumidos (`acknowledged_at === null`) NÃO SHALL ser considerados como tempo zero nem incluídos no cálculo do MTTA.

#### Scenario: Média de MTTA com incidentes reconhecidos no período
- **GIVEN** dois incidentes abertos no período: um assumido após 60 segundos e outro assumido após 120 segundos
- **WHEN** o endpoint calcula as métricas do período
- **THEN** `mtta_seconds` retorna `90`

#### Scenario: MTTA em período sem incidentes assumidos
- **GIVEN** incidentes abertos no período com status `OPEN` e `acknowledged_at` nulo
- **WHEN** o endpoint calcula as métricas do período
- **THEN** `mtta_seconds` retorna `null`

### Requirement: Cálculo determinístico do indicador MTTR (Mean Time To Resolve)
O sistema SHALL calcular o tempo médio de resolução de incidentes no campo `mttr_seconds`:
1. **Critério de Elegibilidade:** SHALL ser considerados exclusivamente os incidentes da tabela `incidents` cujo campo `opened_at` esteja dentro da janela temporal selecionada (`opened_at >= start_time`) E cujo campo `resolved_at` seja não nulo;
2. **Cálculo da Média:** Para cada incidente elegível, computa-se a diferença em segundos entre `resolved_at` e `opened_at`. O `mttr_seconds` será a média aritmética desses valores;
3. **Ausência de Incidentes Elegíveis:** Se não houver nenhum incidente com `resolved_at` preenchido dentro do período, o sistema SHALL retornar `null`;
4. **Preservação de Semântica:** Incidentes em andamento que ainda não foram resolvidos (`resolved_at === null`) NÃO SHALL ser considerados como tempo zero nem incluídos no cálculo do MTTR.

#### Scenario: Média de MTTR com incidentes resolvidos no período
- **GIVEN** um incidente aberto no período e resolvido após 300 segundos, e outro resolvido após 900 segundos
- **WHEN** o endpoint calcula as métricas do período
- **THEN** `mttr_seconds` retorna `600`

#### Scenario: MTTR em período sem incidentes resolvidos
- **GIVEN** incidentes abertos no período que permanecem nos estados `OPEN` ou `INVESTIGATING`
- **WHEN** o endpoint calcula as métricas do período
- **THEN** `mttr_seconds` retorna `null`

### Requirement: Série temporal contínua de volume de execuções
O endpoint SHALL retornar no campo `execution_series` a evolução do volume de execuções agrupada no tempo:
1. **Granularidade por Período:**
   - Para `period=24h`: o agrupamento temporal SHALL ser horário (`date_trunc('hour', created_at)`), totalizando 24 buckets;
   - Para `period=7d`: o agrupamento temporal SHALL ser diário (`date_trunc('day', created_at)`), totalizando 7 buckets;
   - Para `period=30d`: o agrupamento temporal SHALL ser diário (`date_trunc('day', created_at)`), totalizando 30 buckets.
2. **Estrutura dos Buckets:** Cada elemento da série SHALL conter:
   - `timestamp`: string ISO 8601 UTC representando o início do intervalo do bucket;
   - `total`: número inteiro de execuções no intervalo;
   - `success`: quantidade de execuções com status `SUCCESS`;
   - `failed`: quantidade de execuções com status `FAILED`;
   - `timeout`: quantidade de execuções com status `TIMEOUT`.
3. **Preenchimento de Lacunas (Continuous Timeline):** O backend SHALL preencher deterministicamente buckets de datas/horas sem nenhuma execução registrada com `total: 0`, `success: 0`, `failed: 0` e `timeout: 0`, garantindo uniformidade temporal na representação gráfica.

#### Scenario: Geração de série temporal horária para 24 horas
- **GIVEN** execuções distribuídas ao longo das últimas 24 horas com intervalos sem nenhuma execução
- **WHEN** o endpoint processa a requisição com `period=24h`
- **THEN** a lista `execution_series` contém exatamente os buckets horários contínuos cobrindo o período, com os intervalos vazios apresentando contadores zerados

### Requirement: Distribuição consolidada de incidentes por status e severidade
O endpoint SHALL fornecer a distribuição quantitativa de incidentes para visão operacional imediata:
1. `incidents_by_status`: Objeto contendo a contagem global e atual de incidentes para cada um dos quatro status do ciclo de vida:
   - `OPEN`: número de incidentes aguardando reconhecimento;
   - `ACKNOWLEDGED`: número de incidentes assumidos;
   - `INVESTIGATING`: número de incidentes em diagnóstico ativo;
   - `RESOLVED`: número de incidentes já encerrados.
2. `open_incidents_by_severity`: Objeto contendo a contagem de incidentes ativos não resolvidos (`status != 'RESOLVED'`), categorizados por severidade:
   - `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
   Os incidentes com status `RESOLVED` SHALL ser excluídos desta distribuição por severidade, representando estritamente a carga de trabalho operacional pendente.

#### Scenario: Contagem de incidentes ativos por severidade
- **GIVEN** 2 incidentes `CRITICAL` abertos, 1 `HIGH` em investigação e 5 `CRITICAL` já resolvidos
- **WHEN** o endpoint processa a requisição de métricas
- **THEN** `open_incidents_by_severity.CRITICAL` retorna `2`, refletindo apenas os incidentes pendentes de resolução

### Requirement: Listagem prioritária de incidentes recentes para atenção rápida
O endpoint SHALL retornar no array `recent_incidents` uma seleção de até 5 incidentes operacionais ordenados por criticidade:
1. **Regra de Ordenação Multi-critério:**
   - 1º critério: incidentes não resolvidos (`status != 'RESOLVED'`) têm precedência absoluta sobre incidentes resolvidos;
   - 2º critério: maior severidade tem precedência (`CRITICAL` > `HIGH` > `MEDIUM` > `LOW`);
   - 3º critério: timestamp de abertura (`opened_at`) mais recente tem precedência.
2. **Limite de Registros:** O array SHALL conter no máximo 5 registros;
3. **Campos Retornados:** Cada item do array SHALL expor:
   - `id`: identificador UUID do incidente;
   - `status`: status atual do incidente (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`);
   - `severity`: severidade do incidente (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`);
   - `opened_at`: timestamp ISO 8601 da abertura do incidente;
   - `automation`: objeto contendo `{ id: string, name: string }`;
   - `assigned_to`: objeto contendo `{ id: string, name: string, email: string }` ou `null` caso não atribuído.

#### Scenario: Ordenação priorizando incidentes críticos não resolvidos
- **GIVEN** um incidente `LOW` aberto recentemente, um incidente `CRITICAL` em investigação e um incidente `CRITICAL` resolvido minutos antes
- **WHEN** o endpoint gera a lista de `recent_incidents`
- **THEN** o incidente `CRITICAL` em investigação aparece no topo da lista antes do incidente `LOW` aberto e do incidente resolvido
