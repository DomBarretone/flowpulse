# Definição do Problema

## Problema

### Descrição

Hoje, muitas equipes utilizam diferentes automações e pipelines para executar tarefas importantes do dia a dia. Esses processos podem estar distribuídos entre ferramentas como n8n, serviços da AWS, scripts em Python, bancos de dados e outras plataformas.

O problema aparece quando alguma dessas automações falha ou começa a apresentar um comportamento fora do esperado. Em muitos casos, é necessário entrar em diferentes ferramentas, consultar logs ou procurar mensagens de erro para entender o que aconteceu.

Quando existem poucas automações, esse acompanhamento ainda pode ser feito manualmente. Porém, conforme a quantidade de processos aumenta, fica mais difícil saber rapidamente quais falharam, quais continuam executando há muito tempo e quais problemas realmente precisam de atenção primeiro.

Dessa forma, o problema identificado neste projeto é a **dificuldade de acompanhar de forma centralizada as falhas e comportamentos anormais de automações e pipelines**.

### Contexto Atual

As próprias ferramentas de automação já possuem recursos para acompanhar execuções. O n8n, por exemplo, permite consultar se uma execução terminou com sucesso, falhou, continua rodando ou está em espera.

Serviços como o AWS Step Functions também possuem métricas relacionadas a falhas, tempo de execução e timeouts.

Mesmo assim, essas informações normalmente ficam dentro de cada plataforma. Em um cenário onde uma equipe utiliza mais de uma ferramenta, o acompanhamento acaba ficando separado.

Na prática, isso pode exigir ações como:

- consultar manualmente o histórico de uma automação;
- verificar logs para encontrar a causa de um erro;
- acompanhar alertas enviados por e-mail ou ferramentas como Teams e Slack;
- utilizar consultas ou scripts para identificar processos com problema;
- verificar se alguma automação está executando por mais tempo do que deveria.

Outro ponto é que apenas gerar mais alertas nem sempre resolve o problema. Quando existem muitas notificações e todas parecem ter a mesma importância, a equipe pode ter dificuldade para identificar o que realmente precisa ser tratado primeiro.

### Impactos

Esse cenário pode gerar alguns impactos no trabalho da equipe:

- demora para perceber que uma automação apresentou problema;
- necessidade de consultar várias ferramentas para entender uma falha;
- dificuldade para definir quais problemas são mais urgentes;
- processos importantes podem ficar parados por mais tempo;
- aumento da quantidade de alertas e mensagens para acompanhar;
- dificuldade para consultar um histórico de problemas recorrentes.

### Evidências

Durante a pesquisa inicial foi possível encontrar alguns pontos que ajudam a validar o problema.

O n8n possui uma área específica para acompanhamento de execuções, permitindo filtrar resultados como falha, sucesso, execução em andamento e espera. Isso mostra que acompanhar o estado dos workflows é uma necessidade prevista pela própria plataforma.

A AWS também disponibiliza métricas específicas para falhas e timeouts no Step Functions e recomenda que essas métricas sejam monitoradas.

Outro ponto encontrado foi o conceito de *alert fatigue*. A documentação da Microsoft aponta que uma grande quantidade de alertas, principalmente quando não existe uma separação clara por severidade ou contexto, pode dificultar o trabalho de quem precisa responder aos incidentes.

Também existem métricas utilizadas para acompanhar esse tipo de processo, como MTTA (*Mean Time to Acknowledge*) e MTTR (*Mean Time to Resolve*), que ajudam a medir quanto tempo uma equipe leva para reconhecer e resolver um problema.

#### Fontes consultadas

- n8n Docs — All executions: https://docs.n8n.io/workflows/executions/all-executions/
- AWS Step Functions — Monitoring metrics using Amazon CloudWatch: https://docs.aws.amazon.com/step-functions/latest/dg/procedure-cw-metrics.html
- Microsoft Learn — Build a monitoring system for Azure workloads: https://learn.microsoft.com/en-us/azure/well-architected/design-guides/monitoring
- Atlassian — Common Incident Management Metrics: https://www.atlassian.com/incident-management/kpis/common-metrics

## Objetivo

### Objetivo Principal

Criar uma forma mais simples de acompanhar problemas em automações e pipelines, reunindo em um único lugar as informações necessárias para identificar o que falhou e o que precisa de atenção.

### Objetivos Específicos

- reunir informações sobre as execuções das automações;
- facilitar a identificação de falhas e execuções fora do comportamento esperado;
- permitir uma separação dos problemas por prioridade;
- disponibilizar informações que ajudem na investigação do erro;
- manter um histórico das ocorrências;
- permitir o acompanhamento de indicadores relacionados às automações.

### Critérios de Sucesso

Inicialmente, o projeto será considerado bem-sucedido se permitir:

- visualizar as execuções em um único ambiente;
- identificar rapidamente quais automações apresentam problema;
- diferenciar ocorrências mais importantes das demais;
- consultar informações básicas sobre o erro;
- acompanhar o histórico das ocorrências.

Os critérios quantitativos poderão ser definidos posteriormente, durante a etapa de refinamento do produto.

## Público-Alvo

### Perfil Principal

O público principal são profissionais de tecnologia que trabalham diretamente com automações, integrações ou pipelines de dados.

Entre eles estão:

- analistas de dados;
- engenheiros de dados;
- desenvolvedores;
- profissionais responsáveis por operações e processos automatizados.

### Características

São profissionais que normalmente acompanham mais de um processo automatizado e precisam saber quando alguma execução não acontece da forma esperada.

Também possuem conhecimento técnico para entender informações como status de execução, duração e mensagens de erro.

### Necessidades

As principais necessidades identificadas são:

- saber quando uma automação apresentou problema;
- entender quais ocorrências precisam de atenção primeiro;
- evitar a necessidade de consultar várias ferramentas;
- ter informações suficientes para iniciar a análise de uma falha;
- consultar problemas que aconteceram anteriormente.

### Restrições

Por se tratar de uma primeira versão do projeto, o escopo precisa ser controlado.

A proposta inicial não é criar integrações completas com todas as ferramentas disponíveis, nem desenvolver um sistema capaz de corrigir automaticamente as falhas.

O foco será centralizar e organizar as informações necessárias para o acompanhamento das automações. As funcionalidades, tecnologias utilizadas e arquitetura serão definidas com mais detalhes nas próximas etapas do Discovery.
