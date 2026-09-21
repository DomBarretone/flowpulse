# FlowPulse

<p align="center">
  <strong>Plataforma centralizada de monitoramento, triagem e tratamento de incidentes para automações e pipelines de dados.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-blue?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/Next.js-15+-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/NestJS-10+-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v3+-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Clerk-Auth%20%26%20RBAC-6C47FF?style=flat-square&logo=clerk&logoColor=white" alt="Clerk" />
  <img src="https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/license-ISC-green?style=flat-square" alt="License" />
</p>

---

## 📌 Sumário

- [Visão Geral](#visão-geral)
  - [O Problema](#o-problema)
  - [A Solução](#a-solução)
- [Diferenciais & Funcionalidades](#diferenciais--funcionalidades)
- [Tecnologia de Fronteira: Análise Consultiva com IA](#tecnologia-de-fronteira-análise-consultiva-com-ia)
- [Fluxos Centrais de Negócio](#fluxos-centrais-de-negócio)
  - [Fluxo 1: Integração e Ativação de Automação](#fluxo-1-integração-e-ativação-de-automação)
  - [Fluxo 2: Tratamento de Incidente](#fluxo-2-tratamento-de-incidente)
- [Arquitetura & Tecnologias](#arquitetura--tecnologias)
  - [Diagrama de Contexto e Comunicação](#diagrama-de-contexto-e-comunicação)
  - [Visão de Componentes](#visão-de-componentes)
  - [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Guia de Início Rápido (Quickstart)](#guia-de-início-rápido-quickstart)
  - [Pré-requisitos](#pré-requisitos)
  - [Verificação do Ambiente](#verificação-do-ambiente)
  - [Configuração de Variáveis de Ambiente](#configuração-de-variáveis-de-ambiente)
  - [Execução Local](#execução-local)
  - [Execução dos Testes](#execução-dos-testes)
- [Contratos da API REST (`/api/v1`)](#contratos-da-api-rest-apiv1)
- [Segurança, Governança e Boas Práticas](#segurança-governança-e-boas-práticas)
- [Protótipos de Interface](#protótipos-de-interface)
- [Documentação Detalhada](#documentação-detalhada)
- [Contribuindo & Governança](#contribuindo--governança)
- [Licença & Contexto Acadêmico](#licença--contexto-acadêmico)

---

## 📖 Visão Geral

O **FlowPulse** é um produto de software voltado ao monitoramento centralizado, triagem e tratamento de incidentes operacionais para automações e pipelines de dados distribuídos.

### O Problema

Equipes modernas de tecnologia, dados e operações lidam com dezenas a centenas de fluxos automatizados espalhados em ferramentas heterogêneas — como **n8n**, scripts em Python ou Bash, orquestradores em nuvem (ex.: AWS Step Functions, Airflow) e rotinas em bancos de dados.

Quando um fluxo falha, sofre *timeout* ou apresenta lentidão anormal:
- **Detecção tardia:** A falha costuma ser descoberta após impacto direto no usuário final ou negócio;
- **Fadiga de alertas (*Alert Fatigue*):** Alertas dispersos chegam por e-mail, Slack ou Teams sem padronização nem indicação clara de prioridade ou severidade;
- **Investigação fragmentada:** Diagnosticar um erro exige alternar entre diferentes consoles, consultar logs brutos e decifrar exceções técnicas desconexas;
- **Ausência de governança e histórico:** Falta visibilidade sobre quem está atuando no problema, quais causas são recorrentes e quanto tempo a equipe leva para reconhecer (**MTTA**) e resolver (**MTTR**) incidentes.

### A Solução

O **FlowPulse** unifica a observabilidade desses fluxos através de uma **API REST agnóstica**, recebendo eventos padronizados de qualquer fonte monitorada. Ao detectar desvios de SLA ou falhas técnicas:

1. **Gera incidentes formais** com severidade calculada por regras de negócio;
2. **Organiza o ciclo de vida operacional** (`OPEN` → `ACKNOWLEDGED` → `INVESTIGATING` → `RESOLVED`);
3. **Acelera o diagnóstico com IA**, gerando hipóteses estruturadas de causa-raiz e planos de investigação;
4. **Calcula métricas de confiabilidade** (MTTA, MTTR, disponibilidade, taxas de sucesso) e audita todas as transições de forma rastreável.

---

## ⚡ Diferenciais & Funcionalidades

- **Centralização Agnóstica**: Coleta eventos via requisições HTTPS e autenticação segura com chave de API (`x-api-key`), eliminando a dependência de conectores proprietários complexos.
- **Foco em Incidentes, Não Apenas Logs**: Transforma erros técnicos isolados em incidentes acionáveis com severidade, responsável atribuído, prazos e notas de resolução.
- **Ciclo de Vida Operacional Rastreável**: Estados formais com linha do tempo de eventos imutáveis registrada no banco.
- **Controle de Acesso Baseado em Perfis (RBAC)**:
  - `ADMIN`: Cadastra automações, emite/revoga credenciais, ativa monitoramento, configura a plataforma e gerencia acessos.
  - `ANALYST`: Monitora execuções, visualiza dashboards operacionais, assume e investiga incidentes, aciona suporte por IA e conclui resoluções.
- **Métricas Operacionais e de SRE**: Medição contínua de MTTA (*Mean Time to Acknowledge*), MTTR (*Mean Time to Resolve*), volume de execuções e taxas de falha.
- **Segurança de Borda e Isolamento de Dados**: O frontend **não** acessa a base de dados diretamente; toda a comunicação é intermediada pela API REST do NestJS com validação de tokens JWT emitidos pelo Clerk.

---

## 🤖 Tecnologia de Fronteira: Análise Consultiva com IA

O FlowPulse integra modelos de linguagem avançados (via **OpenRouter** ou gateways locais como **OmniRoute** / **OpenCode**) para apoiar analistas durante a investigação técnica.

### Diretrizes e Guardrails Mandatórios

- **Papel Estritamente Consultivo**: A IA **não** altera o status de incidentes, não executa comandos arbitrários e não realiza remediações automáticas em ambientes monitorados.
- **Sanitização de Dados Pré-Envio**: Tokens, credenciais, segredos e informações sensíveis são higienizados pelo backend NestJS antes de qualquer chamada ao provedor de IA.
- **Esquema Estruturado Obrigatório**: A análise gerada é validada contra um schema estrito, contendo:
  - `summary`: Resumo executivo objetivo do que falhou;
  - `likely_causes`: Lista de hipóteses fundamentadas para a causa-raiz;
  - `evidence`: Evidências concretas extraídas dos logs e metadados;
  - `next_steps`: Roteiro recomendado de verificação para o analista;
  - `confidence`: Nível de confiança da análise (0.0 a 1.0).
- **Transparência e Alertas Visuais**: O relatório de IA é apresentado na interface web acompanhado de aviso explícito sobre seu caráter de apoio consultivo à decisão humana.

---

## 🔄 Fluxos Centrais de Negócio

O FlowPulse foi concebido para suportar e validar integralmente dois fluxos de negócio ponta a ponta:

### Fluxo 1: Integração e Ativação de Automação

Garante que uma automação seja cadastrada, configurada com parâmetros de criticidade e limite de duração, receba credencial segura e comprove o envio de evento de teste antes de entrar em monitoramento produtivo:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador
    participant Web as FlowPulse Web (Next.js)
    participant API as FlowPulse API (NestJS)
    participant DB as PostgreSQL (Supabase)
    participant Source as Sistema de Origem (ex: n8n)

    Admin->>Web: Preenche cadastro da automação (nome, SLA, criticidade)
    Web->>API: POST /api/v1/automations (JWT Admin)
    API->>DB: Persiste automação com status DRAFT
    Admin->>Web: Solicita credencial de integração
    Web->>API: POST /api/v1/automations/{id}/api-keys
    API->>DB: Armazena hash SHA-256 da chave
    API-->>Web: Retorna chave em texto plano (exibida uma única vez)
    Source->>API: POST /api/v1/executions (header x-api-key, is_test: true)
    API->>DB: Valida hash SHA-256 e persiste execução de teste
    Web->>API: GET /api/v1/automations/{id} (valida teste realizado)
    Admin->>Web: Clica em "Ativar monitoramento"
    Web->>API: POST /api/v1/automations/{id}/activate
    API->>DB: Atualiza status para ACTIVE e registra auditoria
    API-->>Web: Automação ativa e pronta para eventos de produção
```

### Fluxo 2: Tratamento de Incidente

Acompanha uma falha desde o evento gerador até a investigação assistida e a documentação final de resolução:

```mermaid
sequenceDiagram
    autonumber
    actor Source as Sistema de Origem
    participant API as FlowPulse API (NestJS)
    participant DB as PostgreSQL (Supabase)
    actor Analyst as Analista Operacional
    participant Web as FlowPulse Web (Next.js)
    participant AI as Provedor de IA (OpenRouter)

    Source->>API: POST /api/v1/executions (status: "failed", x-api-key)
    API->>DB: Persiste execução com falha
    API->>DB: Motor de regras cria Incidente (status: OPEN, severidade inicial)
    Analyst->>Web: Visualiza incidente no dashboard
    Analyst->>Web: Clica em "Assumir"
    Web->>API: POST /api/v1/incidents/{id}/acknowledge
    API->>DB: Atribui responsável, status ACKNOWLEDGED e computa MTTA
    Analyst->>Web: Inicia investigação (status: INVESTIGATING)
    Analyst->>Web: Solicita "Analisar com IA"
    Web->>API: POST /api/v1/incidents/{id}/ai-analysis
    API->>AI: Envia payload sanitizado (logs, contexto, metadados)
    AI-->>API: Retorna diagnóstico estruturado (resumo, causas, próximos passos)
    API->>DB: Persiste em ai_analyses
    API-->>Web: Exibe análise com tag consultiva
    Analyst->>Analyst: Executa diagnóstico e correção no sistema de origem
    Analyst->>Web: Registra resolução detalhada e conclui
    Web->>API: POST /api/v1/incidents/{id}/resolve (resolution_notes)
    API->>DB: Atualiza status para RESOLVED, computa MTTR e audita
```

---

## 🏗 Arquitetura & Tecnologias

A arquitetura do FlowPulse adota um modelo **web desacoplado**, com separação estrita de responsabilidades entre frontend e backend.

### Diagrama de Contexto e Comunicação

```mermaid
flowchart LR
    User[Analista / Administrador]
    Source[Sistemas Monitorados\nn8n / AWS / Scripts Python]
    
    subgraph FlowPulse_Platform["Plataforma FlowPulse"]
        FP_Web["Frontend Web\nNext.js + Tailwind CSS"]
        FP_API["Backend API REST (/api/v1)\nNestJS + TypeScript"]
    end

    Clerk["Provedor de Identidade\nClerk (JWKS)"]
    Supabase[("PostgreSQL\nSupabase (Prisma ORM)")]
    AI["Gateway de IA\nOpenRouter / OmniRoute"]
    OTel["Observabilidade\nOpenTelemetry Collector"]

    User -->|HTTPS| FP_Web
    FP_Web -->|Autenticação OIDC| Clerk
    FP_Web -->|REST / HTTPS / JWT| FP_API
    Source -->|REST / HTTPS / x-api-key| FP_API

    FP_API -->|Validar JWT / JWKS| Clerk
    FP_API -->|Prisma Client / TCP| Supabase
    FP_API -->|REST HTTPS| AI
    FP_API -.->|Traces & Métricas| OTel
    FP_Web -.->|Métricas Web Vitals| OTel
```

### Visão de Componentes

```mermaid
flowchart TB
    subgraph Client["Camada Cliente"]
        Browser["Navegador Web"]
    end

    subgraph FrontendApp["Frontend (Next.js - App Router)"]
        UI["Interface de Usuário (Tailwind + shadcn/ui)"]
        ClerkClient["Clerk Frontend SDK"]
        APIFetcher["Client HTTP REST"]
    end

    subgraph BackendApp["Backend (NestJS API REST - /api/v1)"]
        AuthGuard["Clerk JWT Guard & RBAC"]
        ApiKeyGuard["API Key Guard (Hash SHA-256)"]
        AutoModule["Módulo de Automações"]
        ExecModule["Módulo de Execuções"]
        IncModule["Módulo de Incidentes & Regras de SLA"]
        AiModule["Módulo de IA (Sanitização + OpenRouter)"]
        PrismaService["Prisma ORM Client"]
        AuditService["Serviço de Auditoria"]
        OTelSdk["OpenTelemetry Tracing & Metrics"]
    end

    subgraph ExternalServices["Persistência & Serviços Externos"]
        ClerkAuth["Clerk Identity Service"]
        SupabaseDB[("PostgreSQL (Supabase)")]
        OpenRouterAPI["OpenRouter AI Gateway"]
    end

    Browser --> UI
    UI --> ClerkClient
    UI --> APIFetcher
    ClerkClient -.->|Autenticação| ClerkAuth
    APIFetcher -->|HTTPS / JWT /api/v1| AuthGuard

    AuthGuard --> AutoModule
    AuthGuard --> IncModule
    AuthGuard --> AiModule
    ApiKeyGuard --> ExecModule

    AutoModule --> PrismaService
    ExecModule --> PrismaService
    ExecModule --> IncModule
    IncModule --> PrismaService
    AiModule --> OpenRouterAPI
    AiModule --> PrismaService
    AutoModule --> AuditService
    IncModule --> AuditService
    AuditService --> PrismaService

    PrismaService -->|Conexão TCP Segura| SupabaseDB
```

### Stack Tecnológica

| Camada / Função | Tecnologia | Justificativa Técnica |
|---|---|---|
| **Frontend Web** | Next.js (React App Router) + TypeScript | SSR/SPA de alto desempenho, tipagem estrita e roteamento modular |
| **Estilização & UI** | Tailwind CSS + shadcn/ui | Design system consistente, foco operacional, tema escuro e acessibilidade (WCAG 2.1 AA) |
| **Backend API** | NestJS + TypeScript | Arquitetura modular corporativa em camadas (Controllers, Services, Guards, Pipes, Interceptors) |
| **Padrão de API** | RESTful sob `/api/v1` + Swagger/OpenAPI | Interoperabilidade limpa, versionamento explícito e documentação automática |
| **Banco de Dados** | PostgreSQL hospedado no Supabase | Banco relacional confiável com suporte nativo a JSONB para metadados |
| **ORM & Migrações** | Prisma ORM (`@prisma/client`) | Tipagem estrita ponta a ponta gerada do schema e controle versionado de migrações (`prisma migrate`) |
| **Autenticação & RBAC** | Clerk (`@clerk/nextjs` e `@clerk/backend`) | Gestão segura de identidades, tokens JWT com validação via JWKS e papéis `ADMIN` e `ANALYST` |
| **Inteligência Artificial** | OpenRouter / OmniRoute | Gateway resiliente para LLMs de última geração com prompts estruturados e guardrails |
| **Observabilidade** | OpenTelemetry + Logs JSON | Tracing distribuído (`trace_id`), correlação com `request_id` e auditoria imutável |
| **Infra & DevOps** | Docker + Docker Compose + Terraform | Builds OCI multi-stage, orquestração de desenvolvimento e Infraestrutura como Código (IaC) |
| **Testes Automatizados** | Playwright + Jest + Supertest | Pirâmide completa: E2E nos fluxos centrais, integração REST e testes unitários de domínio |

---

## 📂 Estrutura do Repositório

```text
flowpulse/
├── docs/                      # Documentação formal de produto e engenharia
│   ├── problem.md             # Definição e validação do problema (dores, impactos, evidências)
│   ├── prd.md                 # Product Requirements Document (perfis, RFs, RNFs, métricas)
│   ├── spec.md                # Especificação técnica, contratos de API e regras de negócio
│   ├── architecture.md        # Decisões arquiteturais, diagramas C4 e modelos de persistência
│   ├── design.md              # Design system, tokens de cor, acessibilidade e UI
│   ├── environment-setup.md   # Guia de preparação do ambiente e roteiro Open Source AI
│   ├── refinement-review.md   # Revisão e matriz de coerência de discovery
│   └── evidencias/            # Registros e capturas de validação do ambiente
├── apps/                      # Aplicações do monorepo
│   ├── web/                   # Frontend Next.js (App Router, Tailwind, Clerk)
│   │   ├── src/
│   │   │   ├── app/           # Rotas do Next.js (Dashboard, Automações, Incidentes)
│   │   │   ├── components/    # Componentes de interface (shadcn/ui, status badges)
│   │   │   └── lib/           # Clientes HTTP e utilitários
│   │   ├── Dockerfile         # Build OCI multi-stage do frontend
│   │   └── package.json
│   └── api/                   # Backend NestJS REST API (/api/v1)
│       ├── src/
│       │   ├── modules/       # auth, automations, executions, incidents, ai
│       │   ├── common/        # Guards (Clerk, ApiKey), interceptors, decorators
│       │   ├── config/        # Configuração de variáveis com validação Joi/class-validator
│       │   └── main.ts        # Bootstrap da aplicação NestJS
│       ├── prisma/            # Schema relacional e migrações do Prisma
│       │   ├── schema.prisma  # Definição das tabelas e relacionamentos
│       │   └── migrations/    # Histórico versionado de migrações SQL
│       ├── Dockerfile         # Build OCI multi-stage do backend
│       └── package.json
├── infra/
│   └── terraform/             # Módulos de Infraestrutura como Código (IaC)
├── prototypes/                # Referências e roteiro para prototipagem no Stitch
│   └── README.md
├── scripts/                   # Utilitários de automação e validação de ambiente
│   └── check-environment.sh   # Script de verificação automatizada de pré-requisitos
├── tests/                     # Baterias de testes automatizados
│   ├── e2e/                   # Testes ponta a ponta com Playwright
│   └── fixtures/              # Payloads simulados de eventos e execuções
├── .env.example               # Template de variáveis de ambiente (sem segredos)
├── docker-compose.yml         # Orquestração de serviços de suporte para desenvolvimento
├── opencode.json              # Configurações de provedores Open Source AI e MCP servers
├── package.json               # Gerenciador de monorepo e scripts globais
└── README.md                  # Este documento
```

---

## 🚀 Guia de Início Rápido (Quickstart)

### Pré-requisitos

Certifique-se de possuir em seu ambiente de desenvolvimento:
- [Node.js](https://nodejs.org/) (versão LTS 20+ ou 24+)
- [npm](https://www.npmjs.com/) (versão 10+)
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)
- [Playwright](https://playwright.dev/) para suíte de testes E2E

### Verificação do Ambiente

Execute o script utilitário incluído no repositório para validar as ferramentas locais:

```bash
# Executa a verificação dos utilitários necessários
./scripts/check-environment.sh
```

### Configuração de Variáveis de Ambiente

Copie o modelo de variáveis de ambiente e configure suas credenciais de desenvolvimento:

```bash
cp .env.example .env
```

> [!IMPORTANT]
> **Nunca comite o arquivo `.env` no Git.** O repositório já possui regras no `.gitignore` para protegê-lo. Valores reais de chaves e segredos devem ser configurados apenas no ambiente local e injetados com segurança no CI/CD ou runtime de nuvem.

Principais grupos de variáveis contidos em `.env.example`:

| Grupo / Variável | Descrição | Exemplo de Uso Local |
|---|---|---|
| `PROJECT_NAME` / `GLOBAL_PREFIX` | Identificação do projeto e prefixo da API | `FlowPulse`, `api/v1` |
| `FRONTEND_PORT` / `BACKEND_PORT` | Portas locais de execução dos serviços | `3000`, `3001` |
| `NEXT_PUBLIC_API_URL` | URL base consumida pelo frontend | `http://localhost:3001/api/v1` |
| `DATABASE_URL` / `DIRECT_URL` | Strings de conexão com o PostgreSQL (Supabase) | `postgresql://user:pass@host:5432/db` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Chave pública do Clerk para o cliente web | `pk_test_...` |
| `CLERK_SECRET_KEY` / `CLERK_JWT_KEY` | Chave secreta do Clerk para validação no backend | `sk_test_...` |
| `OMNIROUTE_API_KEY` / `CONTEXT7_API_KEY` | Chaves para provedor local Open Source AI e MCP | Conforme setup local |

### Execução Local

#### 1. Instalar as dependências

```bash
npm install
```

#### 2. Executar migrações do banco de dados (Prisma)

```bash
# Sincroniza o schema com o PostgreSQL configurado
npx prisma migrate dev
```

#### 3. Iniciar as aplicações em modo de desenvolvimento

```bash
# Inicia frontend e backend em modo watch/dev
npm run dev
```

- **Frontend Web:** [`http://localhost:3000`](http://localhost:3000)
- **Backend API:** [`http://localhost:3001/api/v1`](http://localhost:3001/api/v1)
- **Documentação Swagger/OpenAPI:** [`http://localhost:3001/api/docs`](http://localhost:3001/api/docs)

### Execução dos Testes

O projeto adota uma pirâmide rigorosa de testes:

```bash
# Executa testes unitários (regras de negócio e cálculo de severidade)
npm run test:unit

# Executa testes de integração de API (supertest contra endpoints NestJS)
npm run test:integration

# Executa testes ponta a ponta (Playwright E2E dos fluxos de negócio)
npx playwright test
```

---

## 📡 Contratos da API REST (`/api/v1`)

Todas as rotas seguem o padrão RESTful sob `/api/v1`, com payloads em `application/json` (UTF-8) e códigos de status HTTP semânticos (conforme RFC 7807 para erros).

| Método | Endpoint | Papel Mínimo (RBAC) | Descrição do Recurso |
|---|---|---|---|
| `POST` | `/api/v1/automations` | `ADMIN` | Cadastra nova automação em estado inicial `DRAFT`. |
| `GET` | `/api/v1/automations` | `ANALYST` / `ADMIN` | Lista automações cadastradas com paginação e filtros. |
| `GET` | `/api/v1/automations/:id` | `ANALYST` / `ADMIN` | Obtém detalhes, status e métricas de uma automação. |
| `POST` | `/api/v1/automations/:id/api-keys` | `ADMIN` | Emite credencial de ingestão (exibida uma única vez; hash SHA-256 no banco). |
| `POST` | `/api/v1/automations/:id/activate` | `ADMIN` | Promove a automação para `ACTIVE` após realização de teste válido. |
| `POST` | `/api/v1/executions` | Chave `x-api-key` | Ingestão de execuções das automações (`started`, `success`, `failed`, `timeout`). |
| `GET` | `/api/v1/executions` | `ANALYST` / `ADMIN` | Consulta histórico de execuções com filtros avançados. |
| `GET` | `/api/v1/incidents` | `ANALYST` / `ADMIN` | Lista fila de incidentes abertos, investigando e resolvidos. |
| `GET` | `/api/v1/incidents/:id` | `ANALYST` / `ADMIN` | Detalhes do incidente, dados da execução, histórico e análises de IA. |
| `POST` | `/api/v1/incidents/:id/acknowledge` | `ANALYST` / `ADMIN` | Analista assume o incidente (`OPEN` → `ACKNOWLEDGED`), computando MTTA. |
| `POST` | `/api/v1/incidents/:id/start-investigation`| `ANALYST` / `ADMIN` | Transita o status do incidente para `INVESTIGATING`. |
| `POST` | `/api/v1/incidents/:id/ai-analysis` | `ANALYST` / `ADMIN` | Dispara análise consultiva de causa-raiz via OpenRouter com payload sanitizado. |
| `POST` | `/api/v1/incidents/:id/resolve` | `ANALYST` / `ADMIN` | Registra notas de resolução e conclui o incidente (`RESOLVED`), computando MTTR. |
| `GET` | `/api/v1/dashboard/summary` | `ANALYST` / `ADMIN` | Retorna métricas agregadas operacionais (taxa de sucesso, MTTA, MTTR, totais). |

---

## 🔒 Segurança, Governança e Boas Práticas

> [!CAUTION]
> **Regra de Isolamento de Dados:** O frontend Next.js é estritamente impedido de conectar-se diretamente ao banco de dados ou utilizar a Supabase Data API (PostgREST) para lógica de negócio. Todas as operações passam exclusivamente pela API REST do NestJS.

- **Autenticação & RBAC:** Tokens JWT emitidos pelo Clerk são verificados no backend através da chave pública JWKS. O acesso aos endpoints sensíveis é protegido por Guards de papéis (`ADMIN` e `ANALYST`).
- **Segurança de Credenciais:** As chaves de integração geradas (`fp_live_...`) são criptografadas com hash **SHA-256** antes de serem salvas no banco. O segredo nunca é persistido em texto claro.
- **Higienização de Dados para IA:** Logs e mensagens de erro passam por filtros de sanitização (remoção de senhas, chaves privadas e dados sensíveis) antes do envio para provedores de LLM.
- **Rastreabilidade e Auditoria:** Middleware global injeta `request_id` e `trace_id` em cada transação, persistindo ações administrativas e transições de estado na tabela `audit_logs`.

---

## 🎨 Protótipos de Interface

Os protótipos de alta fidelidade e telas navegáveis do FlowPulse estão estruturados a partir das diretrizes de design visual em [`docs/design.md`](docs/design.md):

- **Paleta de Cores Operacional**: Tema escuro com superfícies de alto contraste (`#0B0F17`, `#111827`, `#172033`), acentos semânticos de severidade e conformidade com **WCAG 2.1 nível AA** (mínimo de 4.5:1 em contraste de texto).
- **Acessibilidade**: Toda indicação de estado combina cor, ícone e rótulo textual explícito.
- **Telas Prototipadas**: Login, Dashboard Operacional, Lista de Automações, Cadastro & Integração de Automação, Fila de Incidentes, Detalhe do Incidente e Painel de Diagnóstico Assistido por IA.

Para consultar as especificações completas de prototipagem, acesse [`prototypes/README.md`](prototypes/README.md).

---

## 📚 Documentação Detalhada

Toda a concepção, descoberta, especificação técnica e decisões arquiteturais estão detalhadas na pasta [`docs/`](docs/):

| Documento | Descrição e Finalidade |
|---|---|
| [`docs/problem.md`](docs/problem.md) | **Definição do Problema**: Análise de dores, impactos, evidências práticas e objetivos de negócio. |
| [`docs/prd.md`](docs/prd.md) | **Product Requirements Document (PRD)**: Perfis de usuário, requisitos funcionais (RF-01 a RF-10) e não funcionais (RNF-01 a RNF-08). |
| [`docs/spec.md`](docs/spec.md) | **Especificação Técnica do Produto**: Contratos de API REST, schemas de eventos, modelo relacional Prisma e critérios de aceite. |
| [`docs/architecture.md`](docs/architecture.md) | **Arquitetura de Software**: Decisões técnicas, diagramas C4/Mermaid, políticas de segurança, persistência e observabilidade. |
| [`docs/design.md`](docs/design.md) | **Design System**: Tokens de cor, tipografia (Inter), hierarquia visual e diretrizes de acessibilidade WCAG. |
| [`docs/environment-setup.md`](docs/environment-setup.md) | **Ambiente & Ferramentas**: Guia de preparação local, Open Source AI (OmniRoute/OpenCode), chaves e serviços de apoio. |
| [`docs/refinement-review.md`](docs/refinement-review.md) | **Revisão de Refinamento**: Matriz de rastreabilidade entre discovery, negócio, arquitetura e riscos mitigados. |

---

## 👥 Contribuindo & Governança

1. Crie uma branch de trabalho a partir da branch principal (`git checkout -b feature/nome-da-sua-feature`);
2. Siga as diretrizes de código, mantendo tipagem estrita com TypeScript e padrões do ESLint/Prettier;
3. Assegure que os testes unitários, de integração e E2E sejam executados com sucesso (`npm run test:unit`, `npx playwright test`);
4. Envie commits atômicos e claros seguindo o padrão [Conventional Commits](https://www.conventionalcommits.org/);
5. Abra um Pull Request com descrição detalhada das mudanças, referenciando os requisitos pertinentes de [`docs/spec.md`](docs/spec.md) ou [`docs/prd.md`](docs/prd.md).

---

## 📄 Licença & Contexto Acadêmico

Este projeto é desenvolvido no âmbito da Pós-Graduação em Engenharia de Software da **PUC Minas**.

Distribuído sob os termos da licença **[ISC](LICENSE)**. Consulte o arquivo de licença para mais informações.
