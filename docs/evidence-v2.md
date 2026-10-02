# Evidências de Engenharia — Projeto Incremental V2

Este documento consolida o relatório formal de evidências técnicas, arquiteturais e operacionais da entrega do **Projeto Incremental V2** da plataforma **FlowPulse**, desenvolvida no âmbito da Pós-Graduação em Engenharia de Software da **PUC Minas**.

---

## 1. Contexto de Execução e Ambiente

- **Branch de Consolidação Final:** `main` (rastreabilidade via commit Git)
- **Ambiente Local de Desenvolvimento:**
  - **Node.js:** `24.1.0`
  - **npm:** `11.3.0`
  - **Docker:** `29.7.2`
  - **Docker Compose:** `5.5.1`
- **Ambiente de Integração Contínua (CI - GitHub Actions):**
  - **Node.js:** `22` (Runner `ubuntu-latest`)
- **Ferramentas Canônicas do Projeto:**
  - **Terraform CLI:** `1.11.1` (AWS Provider `>= 5.86.0, < 6.0.0`)
  - **OpenSpec CLI:** `1.13.1` (validação estrita de especificações e deltas)
  - **Playwright Test:** `1.63.0` (execução E2E em navegadores reais headless)

---

## 2. Estado de Produção Comprovado (Cloud AWS)

A aplicação encontra-se implantada e operacional na AWS através do pipeline contínuo de entrega:

### 2.1 Conectividade, Roteamento e Serviços ECS Fargate
- **Domínio Público de Produção (HTTPS):** [`https://flowpulse.viniciusbarroso.com.br`](https://flowpulse.viniciusbarroso.com.br)
- **Endpoint Técnico de Saúde do Web:**
  - Requisição: `GET https://flowpulse.viniciusbarroso.com.br/health`
  - Resposta: `HTTP/2 200 OK`
  - Payload: `{"status":"ok"}`
- **Endpoint Técnico de Saúde da API:**
  - Requisição: `GET https://flowpulse.viniciusbarroso.com.br/api/v1/health`
  - Resposta: `HTTP/2 200 OK`
  - Payload: `{"status":"ok","timestamp":"...","uptime":...}`
- **Status do Serviço ECS API (`flowpulse-production-api`):**
  - `DesiredCount: 1` | `RunningCount: 1` | `PendingCount: 0` | `RolloutState: COMPLETED`
- **Status do Serviço ECS Web (`flowpulse-production-web`):**
  - Definição de Tarefa Ativa: `flowpulse-production-web:6` (ou superior)
  - `DesiredCount: 1` | `RunningCount: 1` | `PendingCount: 0` | `RolloutState: COMPLETED`
  - `LastStatus: RUNNING` | `HealthStatus: HEALTHY`
- **Governança de Custos vs. Alta Disponibilidade:**
  - O valor `desired_count = 1` foi configurado intencionalmente para fins de governança e controle de custos no ambiente acadêmico/laboratorial.
  - A arquitetura de infraestrutura como código (`infra/terraform/modules/ecs/`) e a topologia de rede (VPC em 2 Zonas de Disponibilidade com Application Load Balancer multi-AZ) suportam nativamente Alta Disponibilidade com `desired_count = 2` ou superior sem necessidade de refatoração estrutural.

### 2.2 Autenticação em Produção (Clerk Production Instance)
- **Instância de Produção Ativa:** O ambiente produtivo opera com uma **Clerk Production Instance** dedicada e verificada sob o domínio canônico `flowpulse.viniciusbarroso.com.br`.
- **Experiência do Usuário:** O banner de aviso *"Development mode"* foi completamente eliminado da interface pública de autenticação (`/sign-in` e `/sign-up`), operando com fluxo seguro de e-mail e senha.
- **Sincronia Frontend e Backend:** O frontend Next.js (compilado com `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` de produção `pk_live_...`) e o backend NestJS (autenticando via `CLERK_SECRET_KEY` de produção `sk_live_...`) estão estritamente vinculados à mesma instância de produção.
- **Verificação via API:** A chave de backend foi auditada diretamente contra a Clerk Backend API via `GET https://api.clerk.com/v1/instance`, confirmando a resposta com `environment_type = "production"`.

### 2.3 Governança de Segredos no AWS SSM e Rotações Write-Only
Os segredos de runtime da aplicação em produção são injetados exclusivamente a partir do AWS Systems Manager (SSM) Parameter Store:
- `/flowpulse/production/clerk-secret-key`: **`Version = 2`**
- `/flowpulse/production/admin-emails`: **`Version = 2`**
- `/flowpulse/production/database-url`: `Version = 1`
- `/flowpulse/production/openrouter-api-key`: `Version = 1`

**Mecanismo Arquitetural de Rotação Segura (`value_wo_version`):**
O módulo Terraform (`infra/terraform/modules/secrets/`) utiliza os atributos `value_wo` (*write-only*) e `value_wo_version` do recurso `aws_ssm_parameter`. Por diretriz de segurança, atributos `value_wo` não são persistidos no arquivo de estado do Terraform (`terraform.tfstate`), evitando qualquer vazamento de credenciais no bucket S3. De acordo com o contrato do AWS Provider, o Terraform só dispara uma atualização real no SSM Parameter Store quando o contador `value_wo_version` é explicitamente incrementado. Esse mecanismo garante que rotações de credenciais (como a promoção da chave Clerk e da lista de administradores para a versão 2) sejam **intencionais, auditáveis e controladas**, sem regravações desnecessárias a cada execução do pipeline de CD.

### 2.4 Isolamento Arquitetural entre CI (Playwright) e CD (Produção)
Para manter o princípio do menor privilégio e proteger o ambiente de produção contra efeitos colaterais de testes automatizados:
- **CI / E2E (`.github/workflows/ci.yml`):**
  - Utiliza credenciais dedicadas da **Clerk Development Instance** (`E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_CLERK_USER_EMAIL`);
  - O runner executa a aplicação localmente e roda a suíte Playwright contra o double determinístico local do OpenRouter (`http://127.0.0.1:3002`);
  - A execução é serializada (`workers: 1`, `fullyParallel: false`) para garantir isolamento de portas e do banco de teste.
  - Zero dependência ou exposição das credenciais `pk_live_...` e `sk_live_...`.
- **CD / Produção (`.github/workflows/deploy.yml`):**
  - Autenticação com a AWS via **GitHub OIDC** assumindo a Role IAM sem credenciais estáticas de longa duração;
  - Utiliza exclusivamente as credenciais da **Clerk Production Instance** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`);
  - Realiza compilação da imagem Docker Web embutindo a chave pública de produção e entrega as variáveis sensíveis aos containers Fargate via SSM Parameter Store.

---

## 3. Matriz de Requisitos Não Funcionais (RNF-01 a RNF-08)

| Requisito | Implementação Concreta | Arquivos Comprobatórios | Testes e Gates de Qualidade | Evidência de Produção | Status |
|---|---|---|---|---|:---:|
| **RNF-01: Acessibilidade e Portabilidade** | Interface web responsiva em Next.js 15 (App Router), Tailwind CSS e componentes acessíveis com shadcn/ui. Conformidade WCAG 2.1 nível AA: contraste mínimo 4.5:1, navegação completa por teclado, anéis visíveis de foco (`focus-visible:ring-2`), tags semânticas ARIA e status combinando cor, ícone e texto legível. | [`apps/web/src/app/`](../apps/web/src/app), [`apps/web/src/components/`](../apps/web/src/components), [`docs/design.md`](design.md) | 10 suítes de testes unitários do frontend (`apps/web/src/**/*.test.tsx`) e asserções visuais nos testes E2E do Playwright. | Renderização pública e responsiva em navegadores modernos via `https://flowpulse.viniciusbarroso.com.br`. | **ATENDIDO** |
| **RNF-02: Segurança e Confidencialidade** | Autenticação gerenciada pelo Clerk com validação server-side de tokens JWT via chave pública JWKS; autorização RBAC com papéis `ADMIN` e `ANALYST`; chaves de integração (`x-api-key`) armazenadas exclusivamente como hash SHA-256; proibição estrita de acesso direto do frontend ao banco; tráfego encriptado via HTTPS/TLS; sanitização prévia de segredos antes do envio à IA. | [`apps/api/src/common/guards/clerk-auth.guard.ts`](../apps/api/src/common/guards/clerk-auth.guard.ts), [`apps/api/src/common/guards/roles.guard.ts`](../apps/api/src/common/guards/roles.guard.ts), [`apps/api/src/common/guards/api-key.guard.ts`](../apps/api/src/common/guards/api-key.guard.ts), [`apps/api/src/common/sanitization/sanitizer.service.ts`](../apps/api/src/common/sanitization/sanitizer.service.ts) | `apps/api/test/roles.guard.spec.ts`, `apps/api/test/api-key.guard.spec.ts`, `apps/api/test/sanitizer.service.spec.ts`, `scripts/smoke-test.sh` (asserção de 401 sem token). | ALB redireciona HTTP 80 para 443; certificado ACM válido; segredos de runtime gerenciados via SSM Parameter Store sem vazamento em estado. | **ATENDIDO** |
| **RNF-03: Interoperabilidade e APIs RESTful** | Arquitetura REST sob o prefixo `/api/v1` em NestJS; verbos semânticos HTTP (GET, POST, etc.); payloads padronizados em JSON UTF-8; respostas de erro modeladas conforme RFC 7807 (*Problem Details*) contendo `request_id`; documentação OpenAPI gerada automaticamente via Swagger. | [`apps/api/src/main.ts`](../apps/api/src/main.ts), [`apps/api/src/common/filters/problem-details-exception.filter.ts`](../apps/api/src/common/filters/problem-details-exception.filter.ts) | `apps/api/test/problem-details-exception.filter.spec.ts`, 6 suítes Supertest de integração da API (`*.e2e-spec.ts`). | Roteamento por caminho no ALB (`/api/*` para API e `/*` para Web); smoke tests validam `/api/v1/health` retornando 200. | **ATENDIDO** |
| **RNF-04: Observabilidade e Rastreabilidade** | Instrumentação OpenTelemetry no Node.js com auto-instrumentação de HTTP e Prisma; propagação de `trace_id` e injeção de `request_id` em logs estruturados em JSON; registro imutável de ações administrativas e transições em `audit_logs` e `incident_events`. | [`apps/api/src/common/observability/telemetry.ts`](../apps/api/src/common/observability/telemetry.ts), [`apps/api/src/common/logging/json-logger.service.ts`](../apps/api/src/common/logging/json-logger.service.ts), [`apps/api/src/common/middleware/request-id.middleware.ts`](../apps/api/src/common/middleware/request-id.middleware.ts) | `apps/api/test/observability.spec.ts`, `apps/api/test/json-logger.service.spec.ts`, `apps/api/test/request-id.middleware.spec.ts`. | CloudWatch Log Groups com logs estruturados; timeline imutável de eventos consultável na interface web. | **ATENDIDO** |
| **RNF-05: Manutenibilidade e Testabilidade** | Monorepo tipado ponta a ponta com TypeScript estrito (`tsc --noEmit`). Pirâmide completa de testes: 211 testes unitários/integrados (Jest e Supertest) + 6 testes E2E (Playwright) com double determinístico na porta 3002. Linter ESLint e formatação Prettier rigorosos. | [`apps/api/test/`](../apps/api/test), [`apps/web/src/app/`](../apps/web/src/app), [`tests/e2e/`](../tests/e2e), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Execução bem-sucedida de `npm run test`, `npm run test:e2e`, `npm run lint` e `npm run typecheck` no CI. | Pipeline de CI no GitHub Actions executando com código de saída 0 em todas as etapas. | **ATENDIDO** |
| **RNF-06: Portabilidade, IaC e Ambientes** | Ambientes de desenvolvimento (`docker-compose.yml`), validação de produção (`docker-compose.prod.yml`) e produção na AWS Fargate. Imagens Docker multi-stage executando como usuário não-root `node` e versionadas/rastreáveis por Git SHA no Amazon ECR. Infraestrutura da aplicação gerenciada declarativamente por Terraform (CLI 1.11, Provider 5.86+), com bootstrap inicial controlado de recursos externos necessários ao backend remoto e à integração com a AWS.<br><br>**Bootstrap/controlado fora dos módulos Terraform da aplicação:**<br>- GitHub OIDC / IAM role de deploy<br>- Bucket S3 de remote state (`TF_STATE_BUCKET`)<br>- Certificado ACM / validação DNS quando aplicável<br><br>**Gerenciado pelo Terraform:**<br>- Networking (VPC, subnets em 2 AZs, IGW, route tables)<br>- Security Groups<br>- ECR (repositórios com lifecycle policies)<br>- ALB, listeners e target groups<br>- ECS/Fargate (cluster, services, task definitions)<br>- Task IAM execution role<br>- SSM parameters (`value_wo`)<br>- CloudWatch logs | [`docker-compose.yml`](../docker-compose.yml), [`docker-compose.prod.yml`](../docker-compose.prod.yml), [`apps/api/Dockerfile`](../apps/api/Dockerfile), [`apps/web/Dockerfile`](../apps/web/Dockerfile), [`infra/terraform/`](../infra/terraform) | `scripts/verify-docker-context.sh`, `scripts/verify-terraform-secrets.sh`, `terraform validate`, `docker compose config`. | Deploy real no ECS Fargate com serviços ativos, rollout completado e target groups saudáveis. | **ATENDIDO** |
| **RNF-07: Persistência Relacional** | Banco de dados relacional PostgreSQL hospedado no Supabase. Mapeamento relacional estrito via Prisma ORM contendo 8 modelos (`User`, `Automation`, `ApiKey`, `Execution`, `Incident`, `IncidentEvent`, `AiAnalysis`, `AuditLog`). Migrações declarativas e versionadas aplicadas contra o PostgreSQL/Supabase em session mode na porta 5432 antes do rollout de containers. | [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma), [`apps/api/prisma/migrations/`](../apps/api/prisma/migrations) | `apps/api/test/prisma.service.spec.ts`, comandos `npm run db:generate` e `npm run db:migrate`. | Conexão operacional com Supabase; migrações executadas com sucesso pelo CD em porta 5432 antes da substituição de tarefas ECS. | **ATENDIDO** |
| **RNF-08: Governança de Código e Segredos** | Repositório Git no GitHub com rastreabilidade por commits. Dependências travadas em `package-lock.json` e `.terraform.lock.hcl`. Configurações por variáveis de ambiente (`.env.example`). Segredos de runtime injetados via SSM Parameter Store com atributos `value_wo` (write-only), garantindo zero persistência de credenciais no estado do Terraform (`terraform.tfstate`). | [`package.json`](../package.json), [`package-lock.json`](../package-lock.json), [`.env.example`](../.env.example), [`.gitignore`](../.gitignore), [`.dockerignore`](../.dockerignore), [`infra/terraform/modules/secrets/`](../infra/terraform/modules/secrets) | `scripts/verify-terraform-secrets.sh` (canary probe) e inspeção de imagens finais Docker. | Repositório GitHub versionado sem segredos persistidos no código; parâmetros SSM SecureString entregues com segurança às tarefas ECS. | **ATENDIDO** |

---

## 4. Requisitos Funcionais e Fluxos Centrais Homologados

| Requisito / Fluxo | Implementação e Rastreabilidade | Evidência Comprobatória | Status |
|---|---|---|:---:|
| **Fluxo 1: Onboarding e Ativação de Automação** | Cadastro da automação pelo Administrador (`DRAFT`) -> Emissão de chave de integração (`fp_live_...`) exibida uma única vez com hash SHA-256 no banco -> Ingestão de execução de teste (`is_test: true`) via `POST /api/v1/executions` -> Atualização para status `VALIDATED` -> Ativação formal do monitoramento (`ACTIVE`). | [`tests/e2e/flow1-automation-onboarding.spec.ts`](../tests/e2e/flow1-automation-onboarding.spec.ts), [`apps/api/test/automations.e2e-spec.ts`](../apps/api/test/automations.e2e-spec.ts), [`apps/web/src/app/(protected)/automations/new/page.tsx`](../apps/web/src/app/(protected)/automations/new/page.tsx) | **ATENDIDO** |
| **Fluxo 2: Ciclo de Vida do Incidente com IA** | Ingestão de falha operacional via API (`status: FAILED`) -> Criação automática do incidente (`OPEN`) com cálculo de severidade por regras de negócio -> Analista assume (`ACKNOWLEDGED`), computando MTTA -> Inicia investigação (`INVESTIGATING`) -> Dispara análise consultiva de IA sanitizada via OpenRouter -> Persistência de hipóteses e evidências estruturadas -> Registro de notas explicativas obrigatórias de resolução -> Fechamento (`RESOLVED`) com cálculo de MTTR e timeline imutável. | [`tests/e2e/flow2-incident-lifecycle.spec.ts`](../tests/e2e/flow2-incident-lifecycle.spec.ts), [`apps/api/test/incidents.e2e-spec.ts`](../apps/api/test/incidents.e2e-spec.ts), [`apps/web/src/app/(protected)/incidents/[id]/page.tsx`](../apps/web/src/app/(protected)/incidents/[id]/page.tsx) | **ATENDIDO** |
| **Tecnologia de Fronteira: IA Consultiva** | Integração direta do backend NestJS com gateway OpenRouter; higienização prévia determinística via `SanitizerService`; validação de saída contra schema estrito (`summary`, `likely_causes`, `evidence`, `next_steps`, `confidence`); rotulagem visual explícita de tecnologia consultiva; resiliência a falhas de rede (`HTTP 503 RFC 7807`) sem travar a investigação humana. | [`apps/api/src/ai/ai.service.ts`](../apps/api/src/ai/ai.service.ts), [`apps/api/src/common/sanitization/sanitizer.service.ts`](../apps/api/src/common/sanitization/sanitizer.service.ts), [`tests/e2e/helpers/openrouter-mock.ts`](../tests/e2e/helpers/openrouter-mock.ts) | **ATENDIDO** |

---

## 5. Cenário Demonstrativo Real de Produção (Negócio, Incidente e IA)

Para homologação prática e comprovação do comportamento do sistema em ambiente de nuvem real, foi registrado e executado um cenário operacional completo na instância de produção:

### 5.1 Automação Monitorada em Produção
- **Nome:** `Sincronização de Pedidos ERP`
- **Descrição:** `Sincroniza pedidos aprovados do e-commerce com o ERP corporativo e registra falhas de integração para acompanhamento operacional.`
- **Criticidade:** `CRITICAL`
- **Duração Esperada (SLA):** `30 segundos`
- **Estado Operacional:** `ACTIVE`
- **Status da Integração:** `VALIDATED` (após envio prévio de evento de teste no onboarding)

### 5.2 Ingestão de Execuções e Disparo de Incidente CRITICAL
Foram ingeridas execuções operacionais reais através da API REST (`POST /api/v1/executions` autenticada pelo hash SHA-256 de `x-api-key`):
- **4 execuções com status `SUCCESS`:** durações reais de 10.500 ms, 13.000 ms, 15.500 ms e 18.000 ms (média real de 14.250 ms = 14,25 segundos, dentro do SLA esperado de 30s);
- **1 execução com status `FAILED`**:
  - Duração registrada: `47.250 ms` (ultrapassou o SLA de 30s);
  - Mensagem de erro capturada: `"Timeout ao enviar pedido para o ERP: serviço de integração não respondeu dentro do limite esperado."`;
  - **Ação do Sistema:** Como a criticidade da automação é `CRITICAL`, o motor de regras de negócio do FlowPulse gerou automaticamente um incidente formal em status `OPEN` com severidade `CRITICAL`.

### 5.3 Ciclo de Vida do Incidente em Produção
O incidente percorreu todas as transições da máquina de estados, registradas na trilha de auditoria imutável (`incident_events`):
1. **`OPEN`:** Gerado automaticamente pela falha da execução;
2. **`ACKNOWLEDGED`:** Assumido pelo analista humano **Vinicius Barroso**.
   - **MTTA Observado (*Mean Time to Acknowledge*):** **55 segundos**;
3. **`INVESTIGATING`:** Analista inicia os procedimentos diagnósticos e aciona o suporte de IA;
4. **`RESOLVED`:** Conclusão formal com preenchimento da nota explicativa técnica obrigatória registrada pelo analista: *"O serviço de integração com o ERP foi restabelecido após ajuste de conectividade e aumento temporário do timeout. O processamento foi validado novamente com sucesso e o fluxo voltou à operação normal."*
   - **MTTR Observado (*Mean Time to Resolve*):** **2 minutos e 50 segundos** (170 segundos totais desde a abertura).

### 5.4 Diagnóstico Assistido por Inteligência Artificial (OpenRouter)
Durante a fase de investigação, a análise consultiva foi disparada contra o gateway OpenRouter:
- **Modelo Utilizado:** `anthropic/claude-haiku-4.5`
- **Guardrails Aplicados:** Payloads e metadados foram previamente higienizados pelo `SanitizerService` antes do envio. A IA atuou de maneira estritamente **consultiva**, sem autonomia para alterar o status do incidente ou acionar comandos no ERP.
- **Estrutura Validada:**
  - **Resumo Diagnóstico:** Identificação consultiva de que a chamada ao serviço de integração ERP excedeu o tempo limite configurado de 30 segundos;
  - **Causas Prováveis:** Serviço de integração ERP indisponível ou não acessível; degradação de performance / latência elevada; congestionamento de rede ou problema de conectividade; limite de timeout insuficiente;
  - **Evidências:** Duração registrada de 47.250 ms frente ao limite esperado de 30.000 ms e mensagem de erro indicando timeout na integração;
  - **Próximos Passos:** Verificar status e disponibilidade do serviço de integração ERP, auditar latência e estabilidade da rota de rede e reprocessar o lote de pedidos após normalização;
  - **Grau de Confiança:** **72%**.

### 5.5 Métricas Consolidadas no Dashboard de Produção
Os KPIs operacionais na tela `/dashboard` em produção refletem com exatidão o cenário demonstrado:
- **Automações Ativas:** `1`
- **Volume de Execuções:** `5`
- **Taxa de Sucesso:** `80,00%` (4 sucessos em 5 execuções operacionais)
- **Falhas & Timeouts:** `1`
- **Incidentes Abertos:** `0` (incidente devidamente resolvido)
- **MTTA Médio:** `55s`
- **MTTR Médio:** `2m 50s`
- **Gráfico de Série Temporal:** 4 sucessos e 1 falha distribuídos temporalmente.

### 5.6 Regra Operacional: Isolamento de Execuções de Teste (`is_test = true`)
Durante o processo de ativação da automação (Fluxo 1), uma execução com `is_test: true` e `status: SUCCESS` foi processada para comprovar a viabilidade técnica da credencial.
- **Auditoria e Integridade:** Essa execução de teste permanece devidamente armazenada na tabela `executions` para fins de governança e rastreabilidade histórica.
- **Isolamento de KPIs:** No serviço do Dashboard (`DashboardService`), todas as consultas operacionais (`groupBy` de resumo e agregação temporal por `date_trunc`) filtram estritamente por **`is_test: false`**.
- **Resultado:** A execução de teste não contaminou as métricas de produção. Sem essa segregação, o Dashboard exibiria 6 execuções e 83,33% de sucesso. Com a segregação, o Dashboard exibe com precisão **5 execuções e 80,00% de sucesso**.

---

## 6. Arquitetura Final da Solução

### 6.1 Fluxo de Comunicação Verificado

```text
Usuário (Navegador)
  │
  ▼ [HTTPS :443 / Certificado ACM]
Application Load Balancer (ALB)
  │
  ├── Path "/*" ─────────────► Next.js Web (Porta 3000 / ECS Fargate)
  │                              │
  └── Path "/api/*" ─────────┐  ▼ [REST HTTPS / Bearer JWT Clerk]
                             └► NestJS API (Porta 3001 / ECS Fargate)
                                  │
                                  ├── Prisma ORM (TCP :5432 session mode) ──► PostgreSQL (Supabase)
                                  ├── Validação de Assinatura JWKS ────────► Clerk Identity
                                  ├── Análise Consultiva Sanitizada ───────► OpenRouter (LLM)
                                  └── Tracing e Telemetria OTLP ───────────► OpenTelemetry Collector
```

### 6.2 Divisão de Responsabilidades de Infraestrutura

- **Bootstrap Manual / Controlado Inicial:**
  - Provedor GitHub OIDC e Role IAM com política de confiança para o GitHub Actions;
  - Bucket S3 para armazenamento do Terraform Remote State (`TF_STATE_BUCKET`);
  - Certificado SSL/TLS no AWS Certificate Manager (ACM) e validação DNS do domínio.
- **Recursos Gerenciados Declarativamente pelo Terraform:**
  - Módulo Networking: VPC, subnets públicas em 2 AZs, Internet Gateway, route tables e Security Groups;
  - Módulo ECR: repositórios de containers com políticas de ciclo de vida e tags rastreáveis por Git SHA;
  - Módulo ALB: balanceador público, listeners (80 com redirect HTTP 301 para 443 e 443 HTTPS), target groups e regras de path;
  - Módulo ECS: cluster Fargate, task definitions com injeção de segredos via SSM, papéis IAM de execução e serviços ECS;
  - Módulo Secrets: parâmetros SSM SecureString com atributos write-only (`value_wo`);
  - Observabilidade: CloudWatch Log Groups com retenção configurada.

---

## 7. Resultados Reais da Suíte de Testes e Qualidade

| Verificação | Escopo | Resultado Comprovado |
|---|---|:---:|
| **Testes de Backend (API)** | 28 suítes (unitárias e integração com Supertest) | **171 testes passando (PASS)** |
| **Testes de Frontend (Web)** | 10 suítes (componentes e rotas com Testing Library) | **40 testes passando (PASS)** |
| **Total Testes Automatizados Jest** | 38 suítes no monorepo | **211 testes passando (PASS)** |
| **Testes Ponta a Ponta (E2E)** | 4 arquivos Playwright com navegador real headless | **6 testes passando (PASS)** |
| **Análise Estática de Código (Lint)** | ESLint 9 e Prettier 3 em todo o repositório | **0 erros, 0 avisos (PASS)** |
| **Validação Estática de Tipagem** | TypeScript 5.8 em modo estrito (`tsc --noEmit`) | **0 erros (PASS)** |
| **Compilação de Produção (Build)** | `nest build` e Next.js 15 Standalone output | **Compilação com sucesso (PASS)** |
| **Formatação de Infraestrutura (IaC)** | `terraform fmt -check -recursive infra/terraform` | **0 discrepâncias (PASS)** |
| **Validação de Sintaxe HCL** | `terraform validate` no ambiente `production` | **Success! Valid (PASS)** |
| **Sonda Anti-Vazamento de Segredos** | `./scripts/verify-terraform-secrets.sh` (canary probe) | **Zero state leak (PASS)** |
| **Validação Estrita de Especificações** | `npx openspec validate --all --strict` | **29 passed, 0 failed (PASS)** |

---

## 8. Operação Acadêmica, Governança de Custos e Teardown

### 8.1 Dimensionamento no Ambiente de Avaliação
O serviço ECS em produção está configurado com `desired_count = 1` exclusivamente para **governança de custos na conta pessoal da AWS**, evitando cobranças excessivas de computação Fargate durante o período letivo.

> [!CAUTION]
> **AVISO IMPORTANTE:** **NÃO destruir o ambiente antes da avaliação/entrega pelos professores da PUC Minas.** A aplicação e o endpoint `/health` devem permanecer operacionais até a homologação da nota.

### 8.2 Procedimento Seguro de Teardown Posterior à Avaliação
Após o encerramento da avaliação da disciplina, para eliminar completamente cobranças contínuas de Application Load Balancer e instâncias Fargate, execute o procedimento de destruição:

1. Obtenha credenciais com permissão administrativa na AWS (ou assuma a role IAM utilizada no pipeline).
2. Inicialize o backend do Terraform passando os parâmetros do bucket S3 de estado:
   ```bash
   export TF_STATE_BUCKET="<SEU_BUCKET_DE_STATE>"
   export AWS_REGION="us-east-1"

   terraform -chdir=infra/terraform/environments/production init \
     -backend-config="bucket=${TF_STATE_BUCKET}" \
     -backend-config="key=production/terraform.tfstate" \
     -backend-config="region=${AWS_REGION}" \
     -backend-config="encrypt=true" \
     -backend-config="use_lockfile=true"
   ```
3. Execute a destruição segura passando as variáveis obrigatórias:
   ```bash
   terraform -chdir=infra/terraform/environments/production destroy \
     -var="api_image_tag=dummy" \
     -var="web_image_tag=dummy" \
     -var="acm_certificate_arn=<SEU_ACM_CERTIFICATE_ARN>" \
     -var="clerk_publishable_key=pk_dummy" \
     -var="web_origin=https://flowpulse.viniciusbarroso.com.br" \
     -var="database_url=postgresql://dummy" \
     -var="clerk_secret_key=sk_dummy" \
     -var="openrouter_api_key=sk-dummy" \
     -var="flowpulse_admin_emails=admin@flowpulse.local" \
     -var="desired_count=1"
   ```

---

## 9. Configuração de Agentes de IA e Ferramental de Desenvolvimento

### 9.1 Governança do Agente (`AGENTS.md`)
O repositório possui diretrizes canônicas em [AGENTS.md](../AGENTS.md) cobrindo comandos canônicos, stack tecnológica, políticas de segurança (nunca persistir chaves em texto claro, nunca rodar comandos destrutivos) e critérios estritos de conclusão de tarefas.

### 9.2 Skills Especializadas (`.agents/skills`)
Conjunto de habilidades modulares para orientar agentes autônomos nas seguintes disciplinas de engenharia:
- `backend-architect` e `nestjs-expert`: padrões RESTful, injeção de dependência e guards;
- `frontend-ui-engineering` e `web-design-guidelines`: acessibilidade WCAG e componentes React;
- `clerk` e `clerk-setup`: integração segura de autenticação e RBAC;
- `prisma-database-setup`: modelagem relacional e migrações seguras;
- `docker-expert`: otimização de imagens multi-stage e segurança de contêineres;
- `ci-cd-and-automation` e `github-actions-templates`: esteiras de integração e entrega contínua;
- `terraform-style-guide`: convenções declarativas de HCL e modularização.

### 9.3 Servidores MCP (Model Context Protocol)
- **Stitch:** Prototipagem e auditoria de fidelidade de telas;
- **Context7:** Consulta dinâmica à documentação oficial atualizada de frameworks e bibliotecas (Next.js, NestJS, Prisma, Clerk, Terraform, Playwright).