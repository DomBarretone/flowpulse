# Proposal: 07-container-iac-deployment

## Objetivo

Empacotar os serviços em contêineres OCI prontos para produção, provisionar a infraestrutura de nuvem via Terraform executável e automatizar o pipeline de CI/CD completo com GitHub Actions — incluindo deploy automatizado e smoke tests verificando que a aplicação está operacional após cada entrega.

A evidência de implantação automatizada é o pipeline funcionando de ponta a ponta: build → test → push de imagem → apply Terraform → deploy → smoke tests passando. Terraform plan ou documentação isolada não são suficientes.

---

## Escopo

### Incluído

**Dockerfiles — Produção (multi-stage OCI)**
- `apps/api/Dockerfile`:
  - Stage `build`: instala dependências com `npm ci`, compila TypeScript (`nest build`), gera Prisma Client
  - Stage `production`: copia apenas `dist/`, `node_modules` de produção e o Prisma Client; executa com usuário não-root (`node`)
  - Sem secrets ou credenciais na imagem
- `apps/web/Dockerfile`:
  - Stage `build`: instala dependências e executa `next build`
  - Stage `production`: imagem mínima servindo a aplicação Next.js standalone; executa com usuário não-root
- Ambas as imagens compatíveis com o padrão OCI, sem camadas desnecessárias

**Docker Compose — Produção local**
- `docker-compose.yml` atualizado com configuração de produção:
  - Serviço `api`: variáveis de ambiente via `.env`, porta `3001`, healthcheck em `/api/v1/health`
  - Serviço `web`: variáveis de ambiente via `.env`, porta `3000`, healthcheck em `/`
  - Rede interna isolada entre os serviços
- `docker-compose.dev.yml` separado para desenvolvimento com hot-reload (mantendo o de desenvolvimento do change 01)

**Terraform — Infraestrutura como Código**
- Diretório `infra/terraform/` com módulos para:
  - Serviço de execução de contêineres (ex.: Cloud Run, ECS ou equivalente — definido conforme ambiente acadêmico)
  - Variáveis de ambiente e secrets injetados via mecanismo seguro (ex.: Secret Manager, Parameter Store)
  - Regras de rede e HTTPS
- `terraform init`, `terraform plan` e `terraform apply` executáveis no CI
- State backend remoto configurado (ex.: GCS bucket ou S3) para evitar state local
- Nenhuma credencial no código Terraform; todas via variáveis e secrets do CI

**GitHub Actions — Pipeline CI/CD**
- Workflow `ci.yml` (Pull Request):
  1. Checkout + `npm ci`
  2. `npm run lint`
  3. `npm run typecheck`
  4. `npm run test` (unitários + integração)
  5. `npm run build` (next build + nest build)
  6. `npm run test:e2e` (Playwright — Fluxo 1 e Fluxo 2)
- Workflow `deploy.yml` (push na branch `main`):
  1. Execução completa do pipeline de validação (etapas do `ci.yml`)
  2. Build das imagens Docker (`docker build --target production`)
  3. Push das imagens para registry (ex.: GitHub Container Registry ou Docker Hub)
  4. `terraform init && terraform apply -auto-approve` com secrets injetados via GitHub Secrets
  5. Aguarda deploy estabilizar (health check ou wait de serviço)
  6. Smoke tests: `curl` ou script verificando:
     - `GET /api/v1/health` → 200
     - `GET /` (frontend) → 200
     - `GET /api/v1/automations` com token ADMIN → 200 ou 401 (confirma que a API está autenticando)
- Secrets gerenciados via GitHub Secrets (nunca em YAML de workflow em texto plano):
  - `DATABASE_URL`, `CLERK_SECRET_KEY`, `OPENROUTER_API_KEY`, `TERRAFORM_*`, `REGISTRY_TOKEN`

**Healthcheck Endpoint**
- `GET /api/v1/health`: endpoint público (sem autenticação) retornando:
  ```json
  { "status": "ok", "timestamp": "...", "version": "..." }
  ```
- Utilizado pelos Dockerfiles (HEALTHCHECK), Docker Compose e smoke tests do CI

### Excluído

- Multi-tenant ou ambientes múltiplos (staging, homologação) — fora do MVP acadêmico
- CDN ou cache de edge para o frontend
- Auto-scaling automatizado (o Terraform provisiona escala manual inicial)
- Monitoramento externo (Datadog, New Relic etc.)
- Rollback automatizado (ação manual via Terraform destroy + re-apply)

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| — | — | Nenhuma migration. `prisma migrate deploy` é executado no pipeline de deploy antes de subir o serviço da API. |

---

## Critério de Conclusão

**Pipeline CI (`ci.yml`) passa com saída zero em um Pull Request de exemplo:**
```
lint ✓  typecheck ✓  test ✓  build ✓  test:e2e ✓
```

**Pipeline Deploy (`deploy.yml`) executa end-to-end:**
```
validação ✓  docker build ✓  docker push ✓  terraform apply ✓  deploy ✓  smoke tests ✓
```

**Smoke tests passando:**
- `GET /api/v1/health` → 200 `{"status":"ok"}`
- `GET /` → 200 (frontend carregado)
- API autenticando corretamente (401 sem token ou 200 com token válido)

**Verificações de segurança:**
- Nenhuma imagem Docker contém secrets ou credenciais
- Nenhum secret aparece nos logs do GitHub Actions (masked corretamente)
- Imagens executando com usuário não-root (verificado via `docker inspect`)

---

## Não-objetivos

- Terraform plan apenas como artefato de documentação
- Substituir smoke tests por verificação manual
- Configuração de múltiplos ambientes (staging vs. produção)
- Sistema de rollback automatizado

---

## Dependências

- `06-observability-quality` (todos os testes passando, quality gates verificados, pipeline local estável)

---

## Referências

- `@docs/prd.md` — RNF-06 (Portabilidade e Implantação), RNF-08 (Governança)
- `@docs/architecture.md` — DevOps e Infraestrutura, Pipeline de CI/CD, Ambientes, Portabilidade
- `@AGENTS.md` — Never-do: git push --force, secrets em logs ou no git; regra de closure com saída zero
