# Definição de Requisitos do Produto (PRD)

## Descrição do produto

### Problema

O FlowPulse parte de um problema comum em equipes que dependem de automações e pipelines: as informações sobre execução, falhas e alertas ficam distribuídas entre diferentes ferramentas.

Esse problema afeta principalmente profissionais de dados, desenvolvimento e operações. Quando uma automação apresenta falha, timeout ou comportamento fora do esperado, a investigação pode começar tarde e exigir consulta a diferentes sistemas.

O impacto principal é o aumento do tempo para perceber e resolver problemas, além da dificuldade para priorizar incidentes e manter um histórico consolidado.

### Solução

O **FlowPulse** será uma aplicação web para centralizar o acompanhamento de automações e pipelines.

A solução receberá eventos de execução por API REST, armazenará o histórico, aplicará regras para identificar ocorrências relevantes e criará incidentes quando necessário. A partir desse momento, o usuário poderá assumir o incidente, investigar, consultar uma análise assistida por IA e registrar a resolução.

O produto será organizado inicialmente em seis módulos:

1. **Autenticação e acesso** - entrada segura no sistema e controle por perfil.
2. **Automações** - cadastro dos processos que serão monitorados.
3. **Execuções** - recebimento e consulta do histórico de eventos.
4. **Incidentes** - criação, priorização e acompanhamento das ocorrências.
5. **Assistente de IA** - apoio à análise de causa e próximos passos.
6. **Dashboard** - visão consolidada da saúde das automações.

### Diferenciais

- **Visão centralizada:** permite acompanhar processos de diferentes origens no mesmo ambiente.
- **Foco em incidente, não apenas em log:** uma falha deixa de ser somente uma mensagem técnica e passa a ter prioridade, responsável, status e histórico.
- **Contexto para investigação:** o usuário consegue consultar a execução que originou o incidente e seus dados relevantes.
- **Análise assistida por IA:** o sistema pode resumir o erro, levantar hipóteses de causa e sugerir passos de investigação sem resolver automaticamente o incidente.
- **Integração simples:** a primeira versão utiliza uma API REST genérica, evitando depender de conectores específicos para cada plataforma.

---

## Perfis de Usuário

### Analista / Operador

#### Problemas

- precisa consultar diferentes ferramentas para entender se os processos estão saudáveis;
- perde tempo procurando logs e mensagens relacionadas à mesma ocorrência;
- recebe alertas que nem sempre deixam clara a prioridade.

#### Objetivos

- identificar rapidamente o que precisa de atenção;
- concentrar as informações necessárias para investigar uma falha;
- acompanhar o incidente até a resolução.

#### Dados demográficos

- Faixa etária: não é um critério relevante para o produto.
- Localização: equipes presenciais, híbridas ou remotas.
- Outras características relevantes: conhecimento técnico intermediário ou avançado e contato frequente com automações, dados ou integrações.

#### Motivações

- reduzir verificações manuais;
- evitar que falhas importantes permaneçam sem tratamento;
- ganhar visibilidade do histórico das automações.

#### Frustrações

- alternar entre várias ferramentas durante uma investigação;
- receber alertas sem contexto;
- não saber se outra pessoa já está tratando a ocorrência.

### Administrador

#### Problemas

- precisa organizar quais automações serão monitoradas;
- precisa controlar quem pode acessar e alterar informações do sistema;
- precisa garantir que as integrações estejam funcionando.

#### Objetivos

- cadastrar e manter automações;
- configurar credenciais de integração;
- gerenciar usuários e permissões;
- acompanhar o funcionamento geral da plataforma.

#### Dados demográficos

- Faixa etária: não é um critério relevante para o produto.
- Localização: equipes presenciais, híbridas ou remotas.
- Outras características relevantes: conhecimento técnico e responsabilidade sobre o ambiente ou a equipe.

#### Motivações

- padronizar o monitoramento;
- reduzir soluções paralelas criadas para cada automação;
- manter governança sobre o acesso ao sistema.

#### Frustrações

- integrações difíceis de configurar;
- ausência de rastreabilidade sobre alterações;
- dependência de configurações manuais fora do produto.

---

## Funcionalidades

### Requisitos Funcionais

#### RF-01 Autenticação e controle de acesso

- Objetivo: permitir acesso seguro ao FlowPulse por meio de um provedor externo de identidade.
- Perfis iniciais: `ADMIN` e `ANALYST`.
- Usuários sem autenticação não devem acessar dados do produto.

#### RF-02 Cadastro e gestão de automações

- Objetivo: permitir cadastrar, editar, ativar e desativar uma automação monitorada.
- Dados mínimos: nome, descrição, origem, criticidade, responsável padrão e limite esperado de duração.

#### RF-03 Configuração da integração

- Objetivo: permitir que o administrador gere uma credencial para a automação enviar eventos à API.
- A aplicação deverá disponibilizar um endpoint de teste antes da ativação da integração.

#### RF-04 Recebimento de execuções

- Objetivo: receber eventos de execução por API REST.
- Estados mínimos suportados: `started`, `success`, `failed` e `timeout`.
- O evento deverá ser associado a uma automação cadastrada.

#### RF-05 Detecção e criação de incidentes

- Objetivo: identificar automaticamente execuções problemáticas.
- Um incidente poderá ser criado a partir de falha, timeout ou duração superior ao limite configurado.
- O incidente deverá receber severidade inicial conforme regras de negócio.

#### RF-06 Gestão do ciclo de vida do incidente

- Objetivo: acompanhar a ocorrência desde a abertura até a resolução.
- Estados mínimos: `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING` e `RESOLVED`.
- O usuário poderá assumir um incidente, alterar o status e registrar uma resolução.

#### RF-07 Dashboard e indicadores

- Objetivo: apresentar uma visão consolidada das automações.
- Indicadores mínimos: total de execuções, taxa de sucesso, falhas, incidentes abertos, incidentes críticos, MTTA e MTTR.

#### RF-08 Análise assistida por IA

- Objetivo: apoiar a investigação de um incidente real.
- A IA deverá utilizar dados da execução e do incidente para gerar:
  - resumo do erro;
  - hipóteses de causa;
  - evidências utilizadas;
  - próximos passos sugeridos;
  - nível de confiança.
- A análise será somente consultiva e não poderá resolver automaticamente o incidente.

#### RF-09 Histórico e auditoria

- Objetivo: manter o histórico das principais ações realizadas no incidente.
- Devem ser registrados, no mínimo: criação, atribuição, mudança de status, análise de IA e resolução.

#### RF-10 Consulta e filtros

- Objetivo: facilitar a localização das informações.
- Filtros mínimos: automação, período, status, severidade e responsável.

---

## Requisitos Não Funcionais

### RNF-01 Acessibilidade e Portabilidade

O FlowPulse deverá ser uma aplicação web responsiva, compatível com navegadores modernos que suportem HTML5, CSS3 e ECMAScript 2020 ou superior.

A interface deverá seguir práticas de acessibilidade compatíveis com WCAG 2.1 nível AA, incluindo navegação por teclado, foco visível, contraste adequado, textos alternativos e indicação de status que não dependa somente de cor.

### RNF-02 Segurança

A autenticação deverá utilizar provedor externo de identidade. A autorização será baseada em papéis (`ADMIN` e `ANALYST`).

Dados em trânsito deverão utilizar HTTPS/TLS. Segredos e credenciais não poderão ser armazenados no código-fonte. Dados persistidos deverão utilizar os mecanismos de criptografia oferecidos pela infraestrutura.

### RNF-03 Interoperabilidade

As integrações do produto serão disponibilizadas por APIs RESTful utilizando HTTP/HTTPS e JSON.

A API deverá possuir versionamento e documentação OpenAPI.

### RNF-04 Observabilidade e Rastreabilidade

A aplicação deverá produzir logs estruturados, métricas e traces utilizando padrões abertos de observabilidade.

Requisições e processamentos deverão possuir identificadores de correlação. Eventos importantes do ciclo de vida de um incidente deverão ser auditáveis.

### RNF-05 Manutenibilidade e Testabilidade

O projeto deverá possuir testes automatizados de unidade, integração e aceite/end-to-end.

O código será organizado por módulos e deverá passar por lint, testes e validações automatizadas antes de ser integrado à branch principal.

### RNF-06 Portabilidade e Implantação

Os serviços da aplicação deverão ser empacotados em contêineres compatíveis com o padrão OCI.

A infraestrutura de produção deverá ser definida por Infraestrutura como Código. Os serviços de aplicação deverão ser stateless sempre que possível, permitindo escalabilidade horizontal e implantação em mais de uma instância.

### RNF-07 Persistência

A persistência principal utilizará banco de dados relacional PostgreSQL.

Dados de execução, incidentes, histórico e auditoria deverão possuir integridade referencial e migrations versionadas.

### RNF-08 Governança de Código e Configuração

O código e a documentação deverão permanecer em Git e em repositório acessível pela internet.

Dependências deverão possuir declaração formal e lockfile. Configurações específicas de ambiente deverão ser externalizadas em variáveis de ambiente ou serviço equivalente.

---

## Métricas de Sucesso

### Métricas de Negócio

- **Tempo para reconhecer um incidente**
  - Valor atual: ainda não medido.
  - Meta inicial: estabelecer baseline no piloto e reduzir o tempo mediano em pelo menos 30%.
  - Prazo: após 30 dias de uso do MVP.

- **Tempo para resolver um incidente**
  - Valor atual: ainda não medido.
  - Meta inicial: estabelecer baseline e reduzir o MTTR em pelo menos 20%.
  - Prazo: após 60 dias de uso do MVP.

### Métricas de Produto

- percentual de execuções válidas processadas pela API;
- percentual de incidentes que chegam ao estado `RESOLVED`;
- quantidade de automações ativas;
- uso da análise assistida por IA em incidentes;
- percentual de análises de IA avaliadas como úteis pelo usuário.

### Métricas de Operação

- disponibilidade da API;
- latência da ingestão de eventos;
- taxa de erro da API;
- falhas no processamento assíncrono;
- tempo entre recebimento do evento e criação do incidente.

---

## Premissas e Restrições

### Premissas

- os sistemas de origem conseguem realizar chamadas HTTP;
- cada automação será previamente cadastrada;
- os eventos enviados terão um formato mínimo padronizado;
- o usuário possui conhecimento suficiente para interpretar informações técnicas.

### Restrições

- o MVP não realizará correção automática de workflows;
- conectores nativos para todas as ferramentas não fazem parte da primeira versão;
- a IA não poderá executar ações de produção;
- o projeto deve permanecer compatível com o orçamento acadêmico disponível.

### Dependências Externas

- provedor de identidade;
- provedor de modelo de linguagem para a análise assistida;
- infraestrutura de nuvem;
- serviço de banco de dados PostgreSQL.

---

## Escopo

### MVP

#### Incluído

- autenticação;
- cadastro de automações;
- geração de credencial de integração;
- ingestão de eventos por API;
- histórico de execuções;
- criação automática de incidentes;
- severidade e ciclo de vida do incidente;
- dashboard;
- análise assistida por IA;
- auditoria básica;
- filtros e pesquisa.

#### Não Incluído

- correção automática de workflows;
- integração nativa com dezenas de plataformas;
- aplicativo mobile nativo;
- cobrança e planos;
- envio de SMS;
- machine learning próprio para previsão de falhas.

### Versão 1.0

- alertas configuráveis por e-mail e mensageria;
- regras de detecção configuráveis pelo usuário;
- conectores nativos para n8n e AWS Step Functions;
- agrupamento de incidentes por assinatura de erro.

### Versões Futuras

- detecção de anomalias baseada em histórico;
- recomendação de ações a partir de incidentes anteriores;
- remediações automáticas com aprovação humana;
- integrações com ferramentas de ITSM.

---

## Critérios de Aceitação do Produto

### Critérios de Negócio

- uma automação cadastrada deve conseguir enviar uma execução e visualizar o resultado no FlowPulse;
- uma execução com falha deve conseguir gerar um incidente;
- o incidente deve possuir início, acompanhamento e encerramento dentro do próprio sistema;
- a análise assistida por IA deve utilizar dados reais do incidente e ficar registrada.

### Critérios Técnicos

- a API deve possuir documentação OpenAPI;
- dados persistidos devem utilizar PostgreSQL;
- autenticação e autorização devem ser aplicadas aos endpoints protegidos;
- serviços devem executar em contêineres OCI;
- infraestrutura de produção deve possuir definição por código;
- logs, métricas e traces devem ser correlacionáveis.

### Critérios de Qualidade

- os dois fluxos principais devem possuir testes automatizados ponta a ponta;
- regras de negócio críticas devem possuir testes de unidade e integração;
- interface principal deve ser responsiva e navegável por teclado;
- nenhum segredo deve existir no repositório.

---

## Riscos

### Riscos de Negócio

- **Usuário considerar mais simples continuar nas ferramentas atuais**
  - Probabilidade: média.
  - Impacto: alto.
  - Mitigação: manter integração simples e focar na visão consolidada e no ciclo do incidente.

- **Excesso de notificações ser reproduzido dentro do próprio produto**
  - Probabilidade: média.
  - Impacto: médio.
  - Mitigação: priorização por severidade e foco inicial em eventos acionáveis.

### Riscos Técnicos

- **Grande volume de eventos sobrecarregar a ingestão**
  - Probabilidade: média.
  - Impacto: alto.
  - Mitigação: API stateless e processamento desacoplado por fila.

- **Análise de IA gerar sugestão incorreta**
  - Probabilidade: média.
  - Impacto: alto.
  - Mitigação: manter resposta como recomendação, exibir evidências e nível de confiança, e nunca executar correções automaticamente.

- **Logs conterem dados sensíveis**
  - Probabilidade: média.
  - Impacto: alto.
  - Mitigação: limitar payload, aplicar mascaramento e evitar envio de segredos ao modelo de linguagem.

---

## Fora de Escopo

- substituir ferramentas completas de observabilidade;
- executar ações diretamente nos sistemas monitorados sem aprovação;
- armazenar payloads completos sem necessidade;
- atuar como plataforma genérica de ITSM;
- oferecer SLA comercial no MVP acadêmico.

---

## Glossário

### Termos de Negócio

- **Automação:** processo executado de forma automática e monitorado pelo FlowPulse.
- **Execução:** uma ocorrência individual de execução de uma automação.
- **Incidente:** ocorrência que exige análise ou acompanhamento.
- **Severidade:** nível de impacto e prioridade do incidente.
- **Baseline:** referência inicial utilizada para comparar métricas futuras.

### Siglas

- **API:** Application Programming Interface.
- **MTTA:** Mean Time to Acknowledge.
- **MTTR:** Mean Time to Resolve.
- **RBAC:** Role-Based Access Control.
- **OCI:** Open Container Initiative.
- **IaC:** Infrastructure as Code.
- **LLM:** Large Language Model.
