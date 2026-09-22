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
- Prisma ORM instalado e conectado ao PostgreSQL do Supabase via `DATABASE_URL`
- Schema Prisma mínimo contendo **apenas** o modelo `User` (`users`):
  - `id` UUID PK
  - `clerk_user_id` String unique
  - `email` String unique
  - `name` String
  - `role` Enum `ADMIN | ANALYST`
  - `created_at`, `updated_at`
- Primeira migration versionada gerada via `prisma migrate dev`
- `PrismaService` como módulo NestJS global

**Frontend (apps/web)**
- Scaffold Next.js com App Router e TypeScript estrito
- Tailwind CSS configurado
- shadcn/ui instalado com tema base
- `@clerk/nextjs` instalado (configuração será completada no change 02)
- Rota raiz (`/`) com página placeholder indicando estado de desenvolvimento
- Layout raiz com `ClerkProvider` preparado para receber chaves de ambiente

**Docker Compose (desenvolvimento)**
- `docker-compose.yml` com serviços `web` e `api`
- Variáveis de ambiente carregadas de `.env`
- Volumes para hot-reload em desenvolvimento

**Scripts**
- `scripts/check-environment.sh`: valida presença das variáveis de ambiente obrigatórias e conectividade com o banco

### Excluído

- Nenhuma entidade Prisma além de `User`
- Nenhum módulo de negócio (automations, executions, incidents, ai, dashboard)
- Guards de autenticação (Clerk JWT, ApiKeyGuard) — change 02 e 03
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
npm run db:migrate    # migration aplicada com sucesso no Supabase
npm run build         # next build e nest build sem erros
npm run dev           # ambos os serviços sobem sem erros
```

**Testes unitários e de integração:** neste change, o escopo de testes cobre:
- Verificação de que `PrismaService` conecta ao banco sem erros (teste de integração leve com banco de teste)
- Verificação de que o middleware de `request_id` injeta o header corretamente (teste unitário do middleware)
- Verificação de que `ValidationPipe` rejeita payloads inválidos (teste unitário)

---

## Não-objetivos

- Implementar qualquer funcionalidade de negócio
- Antecipar entidades ou módulos dos changes 02–07
- Configurar autenticação real com Clerk (apenas instalar o SDK)
- Dockerfiles de produção multi-stage

---

## Dependências

Nenhuma. Este é o change inicial.

---

## Referências

- `@docs/architecture.md` — Estrutura do repositório, stack tecnológica
- `@AGENTS.md` — Scripts canônicos, regras de migration, never-do list
