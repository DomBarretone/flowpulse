# Proposal: 02-auth-rbac

## Objetivo

Integrar o Clerk como provedor externo de autenticação e implementar o controle de acesso baseado em papéis (RBAC) com perfis `ADMIN` e `ANALYST`, validados exclusivamente no backend NestJS.

Este change entrega o mecanismo completo de identidade e autorização da plataforma: qualquer rota protegida criada nos changes seguintes consumirá os Guards definidos aqui.

---

## Escopo

### Incluído

**Backend (apps/api) — Autenticação Clerk**
- `ClerkAuthGuard`: guard NestJS que valida o Bearer Token JWT emitido pelo Clerk, verificando assinatura contra o JWKS público (`CLERK_JWKS_URL`)
- Extração do `clerk_user_id` e do claim de papel a partir do token validado
- Decorator `@CurrentUser()` para acesso tipado ao usuário autenticado nos controllers
- Decorator `@Roles(Role.ADMIN, Role.ANALYST)` para declaração de autorização por rota

**Backend (apps/api) — RBAC**
- `RolesGuard`: guard que verifica se o papel do usuário autenticado satisfaz os papéis declarados na rota
- Enum `Role` exportado: `ADMIN | ANALYST`
- Combinação `ClerkAuthGuard + RolesGuard` aplicada como guard padrão para rotas protegidas

**Backend (apps/api) — Sincronização de Usuário Local**
- `UsersModule` com `UsersService` e `UsersController`
- Endpoint `POST /api/v1/users/sync` (ou middleware de sincronização automática): ao receber um JWT válido de um usuário ainda não cadastrado localmente, o sistema cria o registro na tabela `users` com `clerk_user_id`, `email`, `name` e `role` extraídos do token
- O papel (`role`) é gerenciado pelo Clerk como claim customizado; o backend persiste o espelho local para consultas relacionais
- `GET /api/v1/users/me`: retorna o perfil do usuário autenticado (dados locais + papel)

**Frontend (apps/web) — Autenticação**
- Configuração completa do `ClerkProvider` com `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Middleware Next.js (`middleware.ts`) protegendo todas as rotas exceto `/sign-in` e `/sign-up`
- Páginas `/sign-in` e `/sign-up` usando componentes do Clerk (`<SignIn />`, `<SignUp />`)
- Redirecionamento automático para dashboard após login bem-sucedido
- Hook `useAuth()` e `useUser()` disponíveis para consumo nos componentes

**Frontend (apps/web) — Estrutura de rotas protegidas**
- Layout protegido em `app/(protected)/layout.tsx` com verificação de sessão ativa
- Página placeholder de dashboard `app/(protected)/dashboard/page.tsx` (conteúdo real em change 05)

### Excluído

- `ApiKeyGuard` (autenticação por `x-api-key` com SHA-256) — change 03
- Qualquer módulo de negócio (automations, executions, incidents)
- Tela de gerenciamento de usuários no frontend (funcionalidade futura)

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| User | `users` | ✅ Já existe (change 01). Nenhuma nova migration necessária. |

---

## Contratos de API

| Método | Rota | Auth | Papel | Descrição |
|--------|------|------|-------|-----------|
| `GET` | `/api/v1/users/me` | Clerk JWT | ADMIN, ANALYST | Retorna perfil do usuário autenticado |

---

## Critério de Conclusão

```bash
npm run test          # testes unitários e de integração deste change passando
npm run typecheck     # sem erros
npm run lint          # sem erros
npm run build         # sem erros
```

**Testes unitários:**
- `ClerkAuthGuard`: mock do JWKS, token válido aceito, token inválido/ausente rejeita com 401
- `RolesGuard`: role ADMIN aceita rota ADMIN-only, role ANALYST rejeita, 403 retornado
- Decorator `@CurrentUser()` extrai dados corretamente do request
- `UsersService.findOrCreate()`: usuário novo é criado, usuário existente é retornado sem duplicar

**Testes de integração (Supertest):**
- `GET /api/v1/users/me` sem token → 401
- `GET /api/v1/users/me` com token ANALYST em rota ADMIN-only → 403
- `GET /api/v1/users/me` com token ADMIN válido → 200 com dados do usuário
- Sincronização: primeiro acesso cria registro em `users`; segundo acesso não duplica

---

## Não-objetivos

- `ApiKeyGuard` para sistemas externos (change 03)
- Gerenciamento de usuários pelo ADMIN via interface (fora do MVP inicial)
- Fluxo de convite ou onboarding multi-tenant

---

## Dependências

- `01-project-foundation` (monorepo, PrismaService, tabela `users`, scripts canônicos)

---

## Referências

- `@docs/spec.md` — Seções 2 (Atores), 6 (Contratos de API), 8 (Segurança)
- `@docs/architecture.md` — Autenticação e Segurança, Fluxo de Autenticação com Clerk
- `@AGENTS.md` — Governança: "Ask first" para alterações em contratos de API
