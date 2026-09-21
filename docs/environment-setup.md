# Preparação do Ambiente - FlowPulse

Este documento registra a preparação inicial do ambiente de desenvolvimento do FlowPulse, seguindo as seções 1, 2 e 3 do Fluxo de Delivery e o roteiro complementar de ambiente Open Source AI.

## 1. Visão geral do fluxo

O fluxo de delivery do projeto será organizado para produzir:

- roadmap de mudanças;
- propostas de mudança;
- planos de testes;
- casos de teste;
- incrementos de produto.

Os participantes principais são Designer UX e Desenvolvedor.

As ferramentas previstas para o projeto são:

- Google Antigravity como ambiente principal com agente de IA;
- OpenSpec para Spec-Driven Development;
- Playwright para automação de testes;
- Git e GitHub para versionamento;
- Docker e Docker Compose para execução padronizada;
- Vercel, Supabase, Clerk, Context7 e Stitch como serviços de apoio;
- OpenCode + OmniRoute como alternativa Open Source AI.

## 2. Orientações gerais

### Ciclo de trabalho

O projeto adotará o ciclo:

1. Research;
2. Plan;
3. Implement.

Para tarefas de planejamento, será priorizado um modelo com maior capacidade de reasoning. Para execução, poderão ser usados modelos mais rápidos quando apropriado.

No Antigravity, cada tarefa relevante deverá começar em uma nova conversa do agente para reduzir perda de contexto.

Ao referenciar arquivos e recursos nos prompts, será utilizado `@`.

### Pré-requisitos

Preencha a versão encontrada após executar `scripts/check-environment.sh`.

| Item | Status | Versão / evidência |
|---|---|---|
| Google Antigravity | [ ] | |
| Node.js | [ ] | |
| npm | [ ] | |
| Git | [ ] | |
| Docker | [ ] | |
| Docker Compose | [ ] | |
| OpenSpec | [ ] | |
| Playwright | [ ] | |
| GitHub | [ ] | conta criada e autenticada |
| Vercel | [ ] | conta criada e autenticada |
| Supabase | [ ] | conta criada e autenticada |
| Clerk | [ ] | conta criada e autenticada |
| Context7 | [ ] | conta criada e autenticada |

## 3. Configuração do projeto

### Documentação geral

A documentação principal deverá permanecer em:

```text
docs/
├── architecture.md
├── design.md
├── prd.md
├── problem.md
└── spec.md
```

### Variáveis de ambiente

O arquivo `.env` deve existir apenas localmente e não deve ser versionado.

Para criar o arquivo inicial:

```bash
cp .env.example .env
```

Depois, preencher as chaves no `.env` com os valores obtidos nos respectivos serviços.

O `.gitignore` contém `.env`, evitando que credenciais sejam enviadas ao GitHub.

> Observação: o roteiro da disciplina informa `BACKEND_PORT=3001`, mas também informa `NEXT_PUBLIC_API_URL=http://localhost:3005/v1`. Os valores foram mantidos exatamente como fornecidos no roteiro e deverão ser revisados quando a API for implementada.

### README

O `README.md` do repositório deverá ser gerado/revisado em uma nova sessão do agente a partir dos arquivos de `docs/`.

Prompt sugerido:

```text
Crie o arquivo README.md para o repositório com base na documentação disponível em @docs.

Siga as boas práticas recomendadas pelo GitHub disponíveis em:
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
```

## Preparação do ambiente Open Source AI

### Providers

O roteiro complementar sugere criar conta em alguns provedores de modelos, entre eles:

- Ollama Cloud;
- OpenRouter;
- AgentRouter;
- Groq;
- OpenCode Zen;
- OpenCode Go;
- Alibaba Model Studio;
- NVIDIA.

Não é necessário utilizar todos. Para o ambiente inicial, registrar abaixo quais foram configurados:

| Provider | Configurado |
|---|---|
| OpenRouter | [ ] |
| Groq | [ ] |
| Outro | [ ] |

### OmniRoute

O OmniRoute será utilizado como gateway local para os providers configurados.

Após a instalação:

```bash
omniroute
```

Dashboard:

```text
http://localhost:20128/
```

No dashboard:

1. acessar **API Key Manager**;
2. criar uma API key;
3. salvar o valor em `OMNIROUTE_API_KEY` no `.env`;
4. acessar **Providers** e configurar os providers escolhidos;
5. em **Compression Settings**, selecionar **Stacked**.

### OpenCode

O OpenCode será utilizado como opção Open Source de agente de desenvolvimento.

Após a instalação, validar:

```bash
opencode --version
```

No OpenCode:

```text
/connect
```

Selecionar OmniRoute e informar a API key criada.

Depois:

```text
/models
```

Selecionar um modelo disponibilizado pelo OmniRoute.

### Configuração do agente

O arquivo `opencode.json` na raiz configura:

- provider OmniRoute;
- MCP Playwright Test;
- MCP Stitch;
- MCP Context7.

As chaves referenciadas pelo arquivo devem permanecer apenas no ambiente local.

> O exemplo publicado no `setup_opensource.md` apresenta uma duplicação da chave `mcp` no bloco JSON. O arquivo deste repositório utiliza a mesma intenção de configuração, mas com JSON válido.

## Evidências recomendadas

Para facilitar a avaliação, registrar:

- saída do script `scripts/check-environment.sh`;
- screenshot do Antigravity instalado;
- screenshot do Docker em execução;
- screenshot do OpenSpec respondendo `--version`;
- screenshot do Playwright respondendo `--version`;
- screenshot do dashboard do OmniRoute;
- screenshot do OpenCode conectado ao OmniRoute;
- confirmação de que `.env` não aparece no `git status`;
- links das contas/serviços sem expor tokens ou chaves.

Nunca incluir valores reais de chaves de API em screenshots ou commits.
