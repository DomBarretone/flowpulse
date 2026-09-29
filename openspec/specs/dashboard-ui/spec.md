# dashboard-ui Specification

## Purpose

Define os requisitos de interface com o usuário (UI/UX) para o painel operacional `/dashboard` no frontend Next.js 15 (`apps/web`), abrangendo cabeçalho executivo, controles acessíveis de período temporal, cards de métricas sintetizadas com tratamento de valores ausentes, representação visual da série temporal de execuções, distribuições estruturadas de incidentes e fila prioritária de ocorrências com acessibilidade WCAG 2.1 AA.

## Requirements

### Requirement: Estrutura do painel operacional e integração com layout autenticado
O frontend Next.js 15 SHALL disponibilizar o painel operacional na rota `/dashboard` dentro do layout autenticado `(protected)`:
1. **Cabeçalho Operacional:** Exibir título "Dashboard Operacional", descrição informativa sobre a saúde das automações e timestamp local legível informando o momento da última geração dos dados;
2. **Autorização Visual:** O dashboard SHALL ser renderizado exclusivamente para usuários com sessão ativa no Clerk possuindo papel `ADMIN` ou `ANALYST`;
3. **Consumo Exclusivo via API REST:** Todas as métricas exibidas SHALL ser obtidas a partir de `GET /api/v1/dashboard/metrics`, sendo vedada a consulta direta ao banco de dados ou Supabase Data API;
4. **Identidade Visual Dark Mode:** A interface SHALL seguir a paleta escura do FlowPulse (tons `zinc-900`, `zinc-950`, bordas sutis `zinc-800` e acentos ciano/esmeralda/âmbar/vermelho).

#### Scenario: Visualização do dashboard por analista autenticado
- **GIVEN** um usuário autenticado com perfil `ANALYST`
- **WHEN** acessa a rota `/dashboard`
- **THEN** a interface renderiza o cabeçalho operacional, os controles de período e os componentes de indicadores sem falhas de layout

### Requirement: Seletor de período com sincronização via query state
A interface do dashboard SHALL disponibilizar um seletor de janelas temporais de análise:
1. **Opções Disponíveis:** Botões ou abas com os rótulos "24 Horas", "7 Dias" e "30 Dias", mapeando respectivamente para os parâmetros `24h`, `7d` e `30d`;
2. **Estado Padrão:** Na ausência de parâmetro na URL, o seletor SHALL marcar a opção "7 Dias" como ativa;
3. **Sincronização na URL:** Ao selecionar um período diferente, a aplicação SHALL atualizar a query string da URL (ex: `/dashboard?period=24h`) através de `router.push` ou `replace` sem causar recarregamento completo da página (`soft navigation`);
4. **Prevenção de Requisições Duplicadas:** Caso o usuário clique na opção do período atualmente ativo, a interface NÃO SHALL disparar nova requisição à API.

#### Scenario: Alternância de período de 7 dias para 24 horas
- **GIVEN** o usuário na página `/dashboard` com período `7d` ativo
- **WHEN** o usuário clica no botão "24 Horas"
- **THEN** a URL é atualizada para `/dashboard?period=24h`, as métricas são recarregadas para o novo período e o botão "24 Horas" recebe destaque visual de estado selecionado

### Requirement: Cards de métricas operacionais com formatação e tolerância a nulos
A interface SHALL renderizar uma grade responsiva com 7 cards de métricas principais:
1. **Automações Ativas:** Exibe o número inteiro de automações com status `ACTIVE`;
2. **Execuções:** Exibe o número inteiro total de execuções registradas na janela temporal;
3. **Taxa de Sucesso:**
   - Exibe o percentual formatado (ex: `"98.5%"` ou `"100%"`);
   - Caso `success_rate === null`, o card SHALL exibir o caractere travessão (`"—"`) com legenda explicativa "Sem execuções concluídas no período";
4. **Falhas:** Exibe a soma de execuções `FAILED` e `TIMEOUT` com destaque visual sutil em tom âmbar/vermelho;
5. **Incidentes Abertos:** Exibe o número total de incidentes ativos (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`);
6. **MTTA (Tempo Médio de Reconhecimento):**
   - Quando numérico, formatar amigavelmente em escala de tempo humana legível (ex: `"45s"`, `"3m 20s"`, `"1h 15m"`);
   - Caso `mtta_seconds === null`, exibir `" — "` com a legenda "Sem incidentes reconhecidos no período";
7. **MTTR (Tempo Médio de Resolução):**
   - Quando numérico, formatar amigavelmente em escala de tempo humana legível (ex: `"12m 30s"`, `"2h 40m"`, `"1d 4h"`);
   - Caso `mttr_seconds === null`, exibir `" — "` com a legenda "Sem incidentes resolvidos no período";
8. **Proteção Contra Erros de Tipagem:** Nenhum card SHALL exibir sob qualquer hipótese as literais `NaN`, `Infinity` ou `undefined`.

#### Scenario: Exibição de cards quando MTTA e MTTR forem nulos
- **GIVEN** uma resposta da API com `mtta_seconds: null` e `mttr_seconds: null`
- **WHEN** os cards de métricas são renderizados na interface
- **THEN** os cards de MTTA e MTTR exibem `" — "` sem quebrar a interface e sem apresentar mensagens de erro ou NaN

### Requirement: Gráfico acessível de série temporal de execuções
A interface SHALL apresentar uma visualização gráfica da evolução do volume de execuções ao longo do tempo a partir de `execution_series`:
1. **Composição Visual:** Gráfico vetorial responsivo (SVG/HTML sem dependências pesadas externas) ilustrando a proporção de execuções com status Sucesso, Falha e Timeout em cada bucket temporal;
2. **Acessibilidade e Tripla Codificação:**
   - A interpretação dos dados NÃO SHALL depender exclusivamente de cores;
   - O gráfico SHALL incluir legenda textual acessível, padrões/estilos distintos ou separação em colunas e tooltips detalhados ao passar o cursor ou focar via teclado;
   - Elemento contendo estrutura semântica legível por leitores de tela (`aria-label` descritivo com resumo dos totais do período);
3. **Linha Contínua:** Intervalos de buckets com contagem zerada SHALL ser renderizados como pontos/barras de nível zero, mantendo a escala temporal visualmente contínua.

#### Scenario: Leitura acessível dos dados do gráfico temporal
- **GIVEN** o gráfico de execuções renderizado para o período de 7 dias
- **WHEN** o usuário passa o mouse ou navega com teclado sobre uma barra da série
- **THEN** uma tooltip exibe data/hora formatada, quantidade de execuções com sucesso, falhas e timeouts de maneira clara e com contraste suficiente

### Requirement: Painel de distribuição de incidentes por status e severidade
A interface SHALL disponibilizar componentes visuais para compreensão rápida da composição de incidentes:
1. **Distribuição por Status (Global):**
   - Barras horizontais proporcionais com contadores numéricos para `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING` e `RESOLVED`;
   - Identificação com rótulo textual e cores temáticas associadas a cada status;
2. **Distribuição por Severidade (Incidentes Ativos):**
   - Barras horizontais proporcionais com contadores numéricos para `LOW`, `MEDIUM`, `HIGH` e `CRITICAL`, contabilizando apenas incidentes não resolvidos;
   - Indicador visual explícito informando que a severidade reflete exclusivamente a carga de trabalho operacional ativa no momento;
3. **Empty State de Distribuição:** Caso não haja incidentes cadastrados na categoria, exibir indicador de 0% com texto neutro ("Nenhum incidente registrado").

#### Scenario: Visualização da distribuição de severidade de incidentes pendentes
- **GIVEN** a seção de distribuição de severidade do dashboard
- **WHEN** os dados são carregados
- **THEN** as barras indicam visualmente e numericamente a proporção de incidentes críticos, altos, médios e baixos que ainda necessitam de tratamento

### Requirement: Tabela de incidentes recentes prioritários com atalho para investigação
A interface SHALL exibir uma tabela resumida contendo até 5 incidentes críticos prioritários:
1. **Campos Exibidos:**
   - **Severidade:** Badge com texto em caixa alta, cor temática e ícone representativo (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`);
   - **Status:** Badge com texto e cor indicativa do estado atual;
   - **Automação:** Nome da automação monitorada de origem;
   - **Aberto em:** Tempo relativo formatado no idioma local (ex: `"há 15 minutos"`, `"ontem às 18:30"`);
   - **Responsável:** Nome do analista responsável ou texto neutro `"Não atribuído"`;
   - **Ação:** Link ou botão contextual direcionando diretamente para `/incidents/:id`.
2. **Empty State:** Caso não haja nenhum incidente registrado, exibir mensagem informativa "Nenhum incidente operacional registrado" com ícone de confirmação.

#### Scenario: Operador clica em incidente prioritário na tabela recente
- **GIVEN** a tabela de incidentes recentes exibindo um incidente crítico
- **WHEN** o operador clica na linha ou no link de ação do incidente
- **THEN** a aplicação navega para `/incidents/[id]` permitindo início imediato do fluxo de investigação

### Requirement: Tratamento de estados assíncronos e resiliência a falhas
A interface do dashboard SHALL tratar com transparência e robustez todos os estados do ciclo de vida da requisição:
1. **Estado de Carregamento (Loading):** Durante a busca de dados, exibir skeleton loaders nos cards de métricas, no gráfico e nas tabelas, preservando o layout sem oscilações bruscas de tela (*content layout shift*);
2. **Estado de Erro da API:** Em caso de resposta de erro HTTP (ex: 500, 503 ou falha de rede), a página NÃO SHALL quebrar ou apresentar tela em branco. A interface SHALL exibir um alerta amigável contendo o detalhe do erro RFC 7807 e um botão "Tentar novamente";
3. **Atualização Manual:** A interface SHALL disponibilizar um botão de atualização ("Atualizar Dados") para permitir nova busca manual sob demanda sem necessidade de recarregar a página inteira no navegador.

#### Scenario: Falha de conexão tratada com alerta e botão de retentativa
- **GIVEN** indisponibilidade temporária do serviço de métricas da API
- **WHEN** a página do dashboard tenta carregar os dados
- **THEN** um componente de alerta é renderizado com mensagem clara de erro e um botão para tentar recarregar os dados
