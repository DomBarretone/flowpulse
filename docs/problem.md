# Definição do Problema

## Problema

### Descrição

Equipes que trabalham com automações, integrações e pipelines de dados precisam acompanhar diariamente a execução de vários processos. Esses processos podem estar distribuídos entre ferramentas como n8n, serviços em nuvem, scripts em Python, bancos de dados e outras plataformas.

O problema aparece quando uma automação falha, demora mais do que deveria ou fica presa em execução. Nesses casos, a pessoa responsável normalmente precisa entrar em diferentes ferramentas, consultar logs e procurar mensagens de erro até entender o que aconteceu.

Quando existem poucas automações, esse acompanhamento ainda é possível de forma manual. Porém, conforme o número de processos aumenta, fica mais difícil saber rapidamente o que falhou, o que é realmente urgente e quem está acompanhando cada problema.

Dessa forma, o problema identificado neste projeto é a **dificuldade de acompanhar, priorizar e tratar de forma centralizada falhas e comportamentos anormais em automações e pipelines**.

### Contexto Atual

As próprias ferramentas de automação oferecem recursos de acompanhamento. O n8n, por exemplo, permite consultar execuções com sucesso, falha, em andamento ou em espera. Serviços de orquestração, como o AWS Step Functions, também disponibilizam métricas relacionadas a falhas, duração e timeouts.

Mesmo com esses recursos, as informações continuam concentradas dentro de cada plataforma. Quando uma equipe utiliza mais de uma ferramenta, o acompanhamento fica fragmentado.

Na prática, isso pode exigir ações como:

- consultar manualmente o histórico de uma automação;
- verificar logs técnicos para encontrar a causa de um erro;
- acompanhar notificações enviadas por e-mail, Teams ou Slack;
- utilizar consultas e scripts próprios para localizar processos com problema;
- verificar se alguma execução está rodando por mais tempo do que o esperado.

Outro ponto é que apenas gerar mais alertas não resolve necessariamente o problema. Quando tudo gera notificação e todas parecem ter a mesma importância, passa a ser difícil identificar o que realmente precisa ser tratado primeiro.

### Impactos

- demora para perceber que uma automação apresentou problema;
- necessidade de consultar várias ferramentas até entender uma falha;
- dificuldade para priorizar os incidentes;
- processos importantes podem permanecer parados por mais tempo;
- excesso de alertas com pouco contexto;
- dificuldade para saber quem está tratando cada ocorrência;
- pouca visibilidade sobre falhas recorrentes.

### Evidências

A pesquisa inicial encontrou alguns pontos que ajudam a validar o problema:

- o n8n possui uma área específica para acompanhamento das execuções e permite filtrar estados como falha, sucesso, execução e espera;
- a AWS disponibiliza métricas específicas para falhas e timeouts em processos orquestrados e recomenda o monitoramento dessas ocorrências;
- a documentação da Microsoft aborda o conceito de *alert fatigue*, que ocorre quando a quantidade de alertas e a falta de priorização reduzem a efetividade do monitoramento;
- métricas como MTTA (*Mean Time to Acknowledge*) e MTTR (*Mean Time to Resolve*) são utilizadas para acompanhar a rapidez com que equipes reconhecem e resolvem incidentes.

#### Fontes consultadas

- n8n Docs - All executions: https://docs.n8n.io/workflows/executions/all-executions/
- AWS Step Functions - Monitoring metrics using Amazon CloudWatch: https://docs.aws.amazon.com/step-functions/latest/dg/procedure-cw-metrics.html
- Microsoft Learn - Build a monitoring system for Azure workloads: https://learn.microsoft.com/en-us/azure/well-architected/design-guides/monitoring
- Atlassian - Common Incident Management Metrics: https://www.atlassian.com/incident-management/kpis/common-metrics

## Objetivo

### Objetivo Principal

Criar uma forma mais simples de acompanhar problemas em automações e pipelines, reunindo em um único lugar as informações necessárias para identificar o que aconteceu, definir prioridade e acompanhar a resolução.

### Objetivos Específicos

- reunir informações sobre as execuções das automações;
- identificar falhas, timeouts e execuções com duração acima do esperado;
- organizar ocorrências por prioridade;
- fornecer informações que ajudem na investigação;
- permitir o acompanhamento do status e responsável por cada incidente;
- manter histórico para identificar problemas recorrentes;
- disponibilizar indicadores básicos de saúde das automações.

### Critérios de Sucesso

O projeto será considerado bem-sucedido se permitir:

- visualizar execuções de diferentes automações em um único ambiente;
- identificar rapidamente as ocorrências que precisam de atenção;
- acompanhar um incidente desde a detecção até a resolução;
- consultar contexto suficiente para iniciar uma investigação;
- reduzir a necessidade de alternar entre várias ferramentas para entender o estado dos processos;
- acompanhar indicadores como taxa de sucesso, tempo para reconhecimento e tempo para resolução.

As metas quantitativas serão validadas durante o MVP, pois ainda não existe uma linha de base medida para comparação.

## Público-Alvo

### Perfil Principal

Profissionais de tecnologia que trabalham diretamente com automações, integrações e pipelines, principalmente analistas de dados, engenheiros de dados, desenvolvedores e profissionais de operações.

### Características

- acompanham mais de um processo automatizado;
- precisam saber quando uma execução não acontece da forma esperada;
- utilizam diferentes ferramentas no mesmo ambiente;
- possuem conhecimento técnico para interpretar status, duração e mensagens de erro;
- precisam decidir quais problemas tratar primeiro.

### Necessidades

- saber rapidamente quando uma automação apresentou problema;
- entender quais ocorrências são mais importantes;
- evitar a consulta constante a várias ferramentas;
- ter informações suficientes para iniciar a análise de uma falha;
- acompanhar quem está responsável pela ocorrência;
- consultar o histórico de problemas anteriores.

### Restrições

- o MVP precisa manter um escopo viável para o projeto acadêmico;
- a primeira versão não pretende oferecer integração nativa com todas as ferramentas do mercado;
- dados sensíveis presentes em logs e payloads não devem ser armazenados sem necessidade;
- a primeira versão terá foco em monitoramento, priorização e acompanhamento, e não em correção automática dos workflows;
- integrações e decisões de infraestrutura devem respeitar requisitos de segurança, portabilidade e custo do projeto.
