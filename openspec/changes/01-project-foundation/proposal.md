# Proposal: 01-project-foundation

## Objetivo

Estabelecer a estrutura base do monorepo FlowPulse com todas as ferramentas, convenções e configurações necessárias para que os changes subsequentes possam ser implementados de forma padronizada e autossuficiente.

Este change não implementa nenhuma regra de negócio. Ele entrega o solo fértil: monorepo funcional, tooling configurado, contêineres de desenvolvimento operacionais, schema Prisma mínimo conectado ao Supabase e scripts canônicos documentados.

---

## Escopo

### Incluído

**Monorepo e tooling**
- Estrutura de diretórios conforme `@docs/architecture.md`: `apps/web`, `apps/api`, `infra/terraform`, `tests/e2e`, `docs`, `scripts`
- `package.json` raiz com workspaces e scripts canônicos: `dev`, `build`, `test`, `typecheck`, `lint`, `db:generate`, `db:migrate`
- `tsconfig.json` base com modo estrito (`"strict": true`) referenciado pelos apps
- ESLint + Prettier configurados no frontend e no backend
- `.env.example` com todas as variáveis de ambiente necessárias documentadas (sem valores reais)
- `.gitignore` cobrindo `node_modules`, `.env`, `dist`, `.next`, arquivos de build

**Backend (apps/api)**
- Scaffold NestJS com `AppModule`, `main.ts` configurando prefixo global `/api/v1`
- `ValidationPipe` global ativo com `whitelist: true` e `forbidNonWhitelisted: true`
- Middleware de `request_id` (UUID v4 por requisição) injetado globalmente
- `@nestjs/swagger` configurado para geração de documentação OpenAPI
- Prisma ORM instalado e conectado ao PostgreSQL via `DATABASE_URL` (suportando PostgreSQL local via Docker Compose em desenvolvimento e Supabase nos ambientes remotos)
- Schema Prisma mínimo contendo **apenas** o modelo `User` (`users`) genérico e agnóstico a provedores de autenticação:
  - `id` UUID PK
  - `email` String unique
  - `name` String
  - `role` Enum `ADMIN | ANALYST`
  - `created_at`, `updated_at`
- Primeira migration versionada gerada via `prisma migrate dev`
- `PrismaService` como módulo NestJS global

**Frontend (apps/web)**
- Scaffold Next.js com App Router e TypeScript estrito
- Tailwind CSS configurado
- shadcn/ui instalado com tema base (sem componentes de negócio)
- Rota raiz (`/`) com página placeholder confirmando funcionamento da aplicação
- Isolamento arquitetural estrito: sem acesso direto ao banco ou `@prisma/client`
- Nenhuma dependência ou configuração de Clerk nesta etapa (pertence exclusivamente ao change 02)

**Docker Compose (desenvolvimento)**
- `docker-compose.yml` com serviços `web`, `api` e `postgres`
- Serviço `postgres` rodando PostgreSQL local com persistência via volume
- Configuração via `DATABASE_URL` permitindo alternar entre PostgreSQL local (desenvolvimento) e Supabase (ambientes remotos)
- Volumes para hot-reload em desenvolvimento para `web` e `api`
- Frontend sem qualquer acesso ao banco de dados

**Scripts**
- `scripts/check-environment.sh`: valida presença das variáveis de ambiente obrigatórias e conectividade com o banco

### Excluído

- Nenhuma entidade Prisma além de `User`
- Nenhum módulo de negócio (automations, executions, incidents, ai, dashboard)
- Nenhuma instalação ou configuração do SDK do Clerk (`@clerk/nextjs`, `@clerk/backend`, `ClerkProvider`) — pertence exclusivamente ao change 02
- Guards de autenticação (Clerk JWT, ApiKeyGuard) — changes 02 e 03
- Scripts fictícios ou placeholders de `test:e2e` que sempre retornem exit code 0 (configuração efetiva do Playwright/E2E reservada para a etapa correspondente)
- Dockerfiles de produção (multi-stage OCI) — change 07
- Terraform e GitHub Actions — change 07
- OpenTelemetry — change 06

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| User | `users` | ✅ Schema + migration |

---

## Critério de Conclusão

```bash
npm run lint          # zero erros ESLint e Prettier
npm run typecheck     # tsc --noEmit sem erros
npm run db:generate   # prisma generate sem erros
npm run db:migrate    # migration aplicada com sucesso no PostgreSQL (local Docker ou Supabase)
npm run test          # suíte de testes reais passando (unitários e integração)
npm run build         # next build e nest build sem erros
npm run dev           # serviços sobem sem erros
```

**Testes unitários e de integração:** neste change, o escopo de testes é estritamente real e cobre:
- Verificação do controlador de saúde da API: teste unitário do `HealthController`
- Verificação de integração HTTP: `GET /api/v1/health` via Supertest retornando 200 unauthenticated
- Verificação de correlação: teste unitário do middleware de `request_id` injetando o header corretamente
- Verificação de validação: teste unitário do `ValidationPipe` rejeitando payloads inválidos com 422
- Verificação do frontend: smoke test confirmando que a rota raiz do Next.js renderiza o título "FlowPulse"
- Verificação de persistência: teste de inicialização e conexão do `PrismaService`

---

## Não-objetivos

- Implementar qualquer funcionalidade de negócio
- Antecipar entidades ou módulos dos changes 02–07
- Instalar ou configurar dependências do Clerk (`@clerk/nextjs`, etc. pertencem exclusivamente ao change 02-auth-rbac)
- Criar script ou placeholder fictício de `test:e2e` que mascare a ausência de testes E2E (configuração efetiva do Playwright pertence à etapa correspondente)
- Dockerfiles de produção multi-stage

---

## Dependências

Nenhuma. Este é o change inicial.

---

## Referências

- `@docs/architecture.md` — Estrutura do repositório, stack tecnológica
- `@AGENTS.md` — Scripts canônicos, regras de migration, never-do list
