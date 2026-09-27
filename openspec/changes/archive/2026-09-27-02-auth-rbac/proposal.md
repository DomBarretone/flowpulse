# Proposal: 02-auth-rbac

## Objetivo

Implementar a autenticação real de usuários utilizando o Clerk como provedor externo de identidade e estabelecer a autorização baseada em papéis (RBAC) com os perfis `ADMIN` e `ANALYST`. A autorização é validada estritamente no backend NestJS, com sincronização confiável no banco relacional PostgreSQL (Supabase) via Prisma ORM e proteção server-side de rotas privadas no frontend Next.js 15.

Este change estabelece o alicerce definitivo de segurança e identidade do FlowPulse: todo acesso de usuários e qualquer rota privada futura consumirá os Guards, decorators e entidades formalizados nesta entrega.

---

## Escopo

### Incluído

**1. Frontend (`apps/web`) — Autenticação e Navegação Segura**
- Instalação e configuração de `@clerk/nextjs`.
- Configuração do `ClerkProvider` no layout raiz (`src/app/layout.tsx`) com suporte aos tokens visuais dark do FlowPulse.
- Adoção das variáveis canônicas e atuais do Clerk:
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard`
  *(substituindo expressamente as variáveis depreciadas `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` e `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`)*.
- Configuração do `middleware.ts` com `clerkMiddleware()` para Next.js 15 sem utilizar `createRouteMatcher()` (evitando APIs depreciadas).
- Política de rotas:
  - Rota raiz `/`: pública.
  - Rotas `/sign-in` e `/sign-up`: públicas (renderizando `<SignIn />` e `<SignUp />`).
  - Rotas sob `/(protected)` e `/dashboard`: privadas, protegidas próximo ao recurso (via Server Components e `await auth.protect()` no layout protegido).
- A página protegida `/dashboard` consome obrigatoriamente `GET /api/v1/users/me` via chamada server-side no Next.js utilizando o token de sessão do Clerk (`Bearer <token>`). O papel (`ADMIN` ou `ANALYST`) exibido provém estritamente do `User` persistido no backend, e não apenas de metadados da sessão cliente.
- Componente `<UserButton />` ou `signOut()` para encerramento de sessão.

**2. Backend (`apps/api`) — Autenticação, Validação JWT e RBAC**
- Instalação e configuração de `@clerk/backend` para validação server-side de tokens JWT.
- Suporte a `CLERK_SECRET_KEY` e `CLERK_JWT_KEY` no backend para validação criptográfica (permitindo validação server-side rápida e sem dependência de rede a cada request).
- `ClerkAuthGuard`: guard NestJS que extrai `Authorization: Bearer <token>`, valida assinatura e expiração via Clerk e injeta a identidade validada em `request.user`.
- Retorno de erro HTTP 401 (*Problem Details* RFC 7807) com `request_id` para requisições não autenticadas ou com tokens inválidos.
- Provisionamento confiável de papéis:
  - Novos usuários recebem `ANALYST` por padrão.
  - O papel `ADMIN` só é atribuído via configuração confiável do backend, utilizando a variável `FLOWPULSE_ADMIN_EMAILS` (lista de emails previamente autorizados).
  - Apenas email primário verificado (`email_verified`) emitido pelo Clerk é considerado para atribuição de `ADMIN` ou vinculação de conta.
  - O backend nunca aceita papéis enviados pelo cliente e nunca utiliza `unsafeMetadata` como fonte de autoridade para RBAC.
- Decorator `@Roles(...roles: Role[])` e `RolesGuard` (`CanActivate`) para controle declarativo de acesso por rota.
- Retorno de erro HTTP 403 (*Problem Details* RFC 7807) com `request_id` para usuários autenticados sem permissão.
- Decorator `@CurrentUser()` para injeção tipada do usuário persistido nos handlers de controllers.

**3. Persistência (`apps/api/prisma`) — Evolução do Modelo User e Sincronização Confiável**
- Evolução do schema Prisma (`apps/api/prisma/schema.prisma`):
  - Adição de `clerk_user_id String @unique` no model `User`.
  - Manutenção de `email String @unique`, `name String`, `role Role @default(ANALYST)`.
- Geração de migration versionada via `npm run db:migrate` (`prisma migrate dev`).
- `UsersService.findOrCreateByClerkId()`:
  - `clerk_user_id` (`sub`) como chave de identidade principal.
  - Não confia em dados de email ou role fornecidos pelo frontend; consome dados validados do token do Clerk.
  - Vinculação por email existente restrita a email primário verificado.
  - Sincronização estritamente idempotente prevenindo duplicidade de contas.
- Endpoints protegidos:
  - `GET /api/v1/users/me`: retorna perfil persistido no banco local (id, clerk_user_id, email, name, role).
  - `POST /api/v1/users/sync`: endpoint idempotente para sincronização explícita de perfil.

**4. Segurança e Governança**
- Segregação estrita de credenciais:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: exclusiva do frontend.
  - `CLERK_SECRET_KEY` e `CLERK_JWT_KEY`: exclusivas do backend (`apps/api`), nunca expostas ao cliente ou versionadas.
  - `FLOWPULSE_ADMIN_EMAILS`: restrita à configuração do backend.
- Atualização de `.env.example` e `scripts/check-environment.sh` com placeholders seguros.
- Proibição absoluta de registrar tokens JWT, senhas ou segredos em logs.
- Frontend nunca acessa diretamente o PostgreSQL ou Supabase Data API.

---

## Não-objetivos (Fora de Escopo)

- Autenticação por chave de API de automações (`ApiKeyGuard` / `x-api-key` / SHA-256) — change `03-automation-integration`.
- Gestão de automações e pipelines — change `03-automation-integration`.
- Gestão de incidentes e integração com OpenRouter — change `04-incident-lifecycle-ai`.
- Dashboard de métricas analíticas e consolidação de MTTA/MTTR — change `05-dashboard-metrics`.
- Testes E2E com Playwright de Fluxos 1 e 2 — change `06-observability-quality`.
- Infraestrutura produtiva, Docker multi-stage e Terraform — change `07-container-iac-deployment`.

---

## Entidades e Migrations

| Entidade | Tabela | Ação neste change | Detalhe |
|----------|--------|-------------------|---------|
| User | `users` | Evolução (ALTER TABLE) | Adição de `clerk_user_id String @unique`. Migration versionada via `prisma migrate dev`. |

---

## Contratos de API

| Método | Endpoint | Autenticação | Papel Exigido | Descrição |
|--------|----------|--------------|---------------|-----------|
| `GET` | `/api/v1/users/me` | Bearer JWT (Clerk) | `ADMIN`, `ANALYST` | Retorna o perfil persistido do usuário autenticado no banco de dados. |
| `POST` | `/api/v1/users/sync` | Bearer JWT (Clerk) | `ADMIN`, `ANALYST` | Sincroniza dados confiáveis do Clerk com o banco relacional local de forma idempotente. |

### Exemplo de Resposta: `GET /api/v1/users/me` (200 OK)
```json
{
  "id": "e0a1c6a2-9387-4b77-83d4-8d94c1c9e801",
  "clerk_user_id": "user_2test123456789",
  "email": "admin@flowpulse.io",
  "name": "Admin FlowPulse",
  "role": "ADMIN",
  "created_at": "2026-09-27T21:00:00.000Z",
  "updated_at": "2026-09-27T21:00:00.000Z"
}
```

### Exemplo de Erro: Não Autenticado (401 Unauthorized)
```json
{
  "type": "https://flowpulse.io/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Missing or invalid authorization token",
  "instance": "/api/v1/users/me",
  "request_id": "9f8b4d8e-3a21-4f12-9c32-b7e8d91a2b3c"
}
```

### Exemplo de Erro: Acesso Negado (403 Forbidden)
```json
{
  "type": "https://flowpulse.io/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "User role does not satisfy the required role(s): ADMIN",
  "instance": "/api/v1/admin/example",
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## Critérios de Aceite e Conclusão

- [ ] Login real via Clerk funciona na interface web e redireciona para `/dashboard` utilizando `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`.
- [ ] Logout encerra a sessão e redireciona para rota pública.
- [ ] Rota `/` é pública; rotas `/sign-in` e `/sign-up` são públicas.
- [ ] Rota `/dashboard` e o grupo `/(protected)` exigem autenticação ativa.
- [ ] A página `/dashboard` consome `GET /api/v1/users/me` server-side e exibe o papel persistido no banco de dados.
- [ ] Backend valida tokens JWT do Clerk com `CLERK_SECRET_KEY` e suporte a `CLERK_JWT_KEY`.
- [ ] Novos usuários recebem `ANALYST` por padrão; apenas emails presentes em `FLOWPULSE_ADMIN_EMAILS` com verificação primária recebem `ADMIN`.
- [ ] O backend ignora qualquer tentativa do cliente de definir seu próprio papel ou usar `unsafeMetadata`.
- [ ] Sincronização Clerk -> User é idempotente e utiliza `clerk_user_id` como identidade principal.
- [ ] Requisições não autenticadas recebem HTTP 401 RFC 7807 com `request_id`.
- [ ] Requisições com papel incompatível recebem HTTP 403 RFC 7807 com `request_id`.
- [ ] Nenhuma credencial real ou chave privada é versionada no repositório.
- [ ] `npm run lint` executa sem erros em todo o monorepo.
- [ ] `npm run typecheck` passa sem erros estáticos (`apps/api` e `apps/web`).
- [ ] `npm run test` passa com código de saída 0.
- [ ] `npm run build` compila as duas aplicações com sucesso.

---

## Testes Obrigatórios

1. **Testes Unitários Backend (`apps/api`):**
   - `ClerkAuthGuard`: sucesso com token válido, rejeição 401 para token ausente/inválido.
   - `RolesGuard`: concessão para `ADMIN`, bloqueio 403 para `ANALYST` em recurso `ADMIN`, concessão em rotas liberadas para ambos.
   - Provisionamento de papéis: novo usuário recebe `ANALYST`; usuário com email verificado contido em `FLOWPULSE_ADMIN_EMAILS` recebe `ADMIN`.
   - Proteção de integridade: payload ou metadados de role enviados pelo cliente são expressamente ignorados.
   - `UsersService`: criação na primeira chamada e retorno idempotente na sincronização repetida sem duplicar registro.

2. **Testes de Integração Backend (`apps/api` - Supertest):**
   - `GET /api/v1/users/me` sem token → HTTP 401 RFC 7807 com `request_id`.
   - `GET /api/v1/users/me` com token válido → HTTP 200 retornando o papel persistido no banco.
   - Rota restrita a `ADMIN` acessada por `ANALYST` → HTTP 403 RFC 7807 com `request_id`.
   - Rota restrita a `ADMIN` acessada por `ADMIN` → HTTP 200.

3. **Testes Frontend (`apps/web`):**
   - Estado não autenticado: acesso a rota privada é bloqueado/redirecionado.
   - Estado autenticado: página `/dashboard` renderiza consumindo `GET /api/v1/users/me`, exibindo papel persistido e botão de logout.

---

## Dependências

- `01-project-foundation` (scaffold do monorepo, NestJS base, Next.js base, PrismaService e scripts canônicos).

---

## Referências

- `@docs/spec.md` — Seções 2, 5, 6 e 8.
- `@docs/prd.md` — RF-01 e RNF-02.
- `@docs/architecture.md` — Autenticação Clerk e RBAC.
- `@docs/design.md` — SignIn, Dashboard e Tokens Visuais.
- `@AGENTS.md` — Regras de Governança e Closure Criteria.
