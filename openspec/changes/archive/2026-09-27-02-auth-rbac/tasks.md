# Tasks: 02-auth-rbac

## 1. Environment & Dependencies Setup
- [x] 1.1 Atualizar `.env.example` com as variáveis canônicas atuais do Clerk:
  - Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard` (substituindo expressamente as variáveis legadas `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` e `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`).
  - Backend: `CLERK_SECRET_KEY`, `CLERK_JWT_KEY` (chave pública PEM para validação local), `FLOWPULSE_ADMIN_EMAILS=admin@flowpulse.io`.
- [x] 1.2 Atualizar `scripts/check-environment.sh` para verificar a presença das variáveis de autenticação obrigatórias sem expor valores sensíveis.
- [x] 1.3 Instalar `@clerk/backend` em `apps/api` para validação criptográfica de tokens.
- [x] 1.4 Instalar `@clerk/nextjs` em `apps/web` para suporte de autenticação no Next.js 15 App Router.

## 2. Database Schema & Migration (User Model Evolution)
- [x] 2.1 Atualizar `apps/api/prisma/schema.prisma` adicionando o campo `clerk_user_id String @unique` no modelo `User`.
- [x] 2.2 Gerar migration Prisma versionada via `npm run db:migrate` (`add_clerk_user_id`), garantindo criação de coluna e índice único no PostgreSQL sem recorrer a `db push`.
- [x] 2.3 Executar `npm run db:generate` para atualizar o Prisma Client com os novos tipos do modelo `User`.

## 3. Backend Identity, Auth Guard & Trusted Users Module
- [x] 3.1 Implementar `ClerkAuthGuard` em `apps/api/src/common/guards/clerk-auth.guard.ts` interceptando `Authorization: Bearer <token>`, suportando validação com `CLERK_SECRET_KEY` e validação local com `CLERK_JWT_KEY`.
- [x] 3.2 Garantir retorno de HTTP 401 (*Problem Details* RFC 7807) com `request_id` para tokens ausentes, expirados ou inválidos.
- [x] 3.3 Implementar o decorator `@CurrentUser()` em `apps/api/src/common/decorators/current-user.decorator.ts` para injeção tipada da entidade `User` persistida.
- [x] 3.4 Criar `UsersModule`, `UsersService` e `UsersController` em `apps/api/src/users/`.
- [x] 3.5 Implementar provisionamento e sincronização confiável em `UsersService.findOrCreateByClerkId()`:
  - Utilizar `clerk_user_id` (`sub`) como chave principal;
  - Desconsiderar qualquer role ou email fornecido pelo payload do frontend ou `unsafeMetadata`;
  - Atribuir `Role.ANALYST` por padrão para novos usuários;
  - Atribuir `Role.ADMIN` apenas se o email primário for verificado (`email_verified === true`) e constar em `FLOWPULSE_ADMIN_EMAILS`;
  - Permitir vinculação por email existente apenas para email primário verificado;
  - Garantir idempotência total evitando duplicações em requisições concorrentes ou repetidas.
- [x] 3.6 Implementar endpoint protegido `GET /api/v1/users/me` retornando o perfil do usuário e o papel efetivamente persistido no banco.
- [x] 3.7 Implementar endpoint protegido `POST /api/v1/users/sync` para sincronização explícita de perfil.

## 4. Backend RBAC (Roles, Decorator & Guard)
- [x] 4.1 Definir ou exportar o enum `Role` (`ADMIN`, `ANALYST`) e implementar o decorator declarativo `@Roles(...roles: Role[])` em `apps/api/src/common/decorators/roles.decorator.ts`.
- [x] 4.2 Implementar `RolesGuard` em `apps/api/src/common/guards/roles.guard.ts` consumindo `Reflector` e validando `request.user.role` contra as roles permitidas na rota.
- [x] 4.3 Garantir retorno de HTTP 403 (*Problem Details* RFC 7807) com `request_id` quando o usuário autenticado não possuir o papel exigido.
- [x] 4.4 Garantir liberação permissiva de acesso em rotas autenticadas que não declararem anotação `@Roles()`.

## 5. Frontend Clerk Integration & Next.js 15 Route Protection
- [x] 5.1 Envolver o layout raiz (`apps/web/src/app/layout.tsx`) com `<ClerkProvider>` consumindo `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e aplicando os tokens de tema dark do FlowPulse.
- [x] 5.2 Configurar `apps/web/src/middleware.ts` com `clerkMiddleware()` para repasse e sincronização de sessão sem utilizar a API depreciada `createRouteMatcher()`.
- [x] 5.3 Garantir que a rota raiz `/` e as rotas de autenticação `/sign-in` e `/sign-up` permaneçam públicas.
- [x] 5.4 Implementar proteção de rota próximo ao recurso no layout do grupo protegido `apps/web/src/app/(protected)/layout.tsx` através de `await auth.protect()`.
- [x] 5.5 Criar páginas dedicadas de login em `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` (`<SignIn />`) e cadastro em `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx` (`<SignUp />`).

## 6. Verification UI & Server-Side Data Fetching (/dashboard)
- [x] 6.1 Implementar a página protegida `apps/web/src/app/(protected)/dashboard/page.tsx` como Server Component que:
  - Obtém o token de sessão do Clerk via `auth().getToken()`;
  - Executa chamada server-side a `GET /api/v1/users/me` com `Authorization: Bearer <token>`;
  - Renderiza na tela o papel persistido (`ADMIN` ou `ANALYST`), ID do Clerk e email;
  - Exibe o componente `<UserButton />` ou botão de logout funcional.
- [x] 6.2 Garantir conformidade com as diretrizes de design system de `@docs/design.md` (paleta zinc, tipografia limpa, acessibilidade e foco visível).

## 7. Comprehensive Test Suite
- [x] 7.1 **Testes Unitários Backend (`apps/api`):**
  - Teste de `ClerkAuthGuard`: sucesso com token válido, 401 por ausência de header, 401 por token inválido/expirado, suporte a validação via `CLERK_JWT_KEY`.
  - Teste de `RolesGuard`: concessão para `ADMIN`, bloqueio 403 para `ANALYST` em recurso restrito a `ADMIN`, concessão em rotas sem `@Roles`.
  - Teste do decorator `@CurrentUser()`.
  - Testes de provisionamento e sincronização em `UsersService`:
    - Usuário novo recebe `ANALYST` por padrão;
    - Usuário com email verificado contido em `FLOWPULSE_ADMIN_EMAILS` recebe `ADMIN`;
    - Tentativa de enviar role pelo cliente ou via `unsafeMetadata` é ignorada;
    - Sincronização repetida não duplica usuário (idempotência preservada);
    - Vinculação por email existente só ocorre com email primário verificado.
- [x] 7.2 **Testes de Integração Backend (`apps/api` via Supertest):**
  - `GET /api/v1/users/me` sem token gerando HTTP 401 RFC 7807 com `request_id`.
  - `GET /api/v1/users/me` com token válido retornando HTTP 200 e o papel persistido no banco de dados.
  - Rota protegida com `@Roles(Role.ADMIN)` acessada por usuário `ANALYST` gerando HTTP 403 RFC 7807 com `request_id`.
  - Rota protegida com `@Roles(Role.ADMIN)` acessada por usuário `ADMIN` retornando HTTP 200.
  - `POST /api/v1/users/sync` testando idempotência.
- [x] 7.3 **Testes Frontend (`apps/web` via Jest + React Testing Library):**
  - Testar bloqueio/redirecionamento de rotas protegidas em estado não autenticado.
  - Testar renderização da página `/dashboard` em estado autenticado, comprovando consumo de `/users/me` e exibição do papel persistido.

## 8. Quality Gates & Closure Verification
- [x] 8.1 Executar `npm run lint` na raiz e garantir zero erros em todo o monorepo.
- [x] 8.2 Executar `npm run typecheck` e validar tipagem estrita no backend e frontend (`tsc --noEmit`).
- [x] 8.3 Executar `npm run test` e garantir que todos os testes passem com código de saída 0.
- [x] 8.4 Executar `npm run build` e confirmar compilação bem-sucedida de `apps/api` e `apps/web`.
- [x] 8.5 Confirmar que nenhum segredo real ou chave privada (`CLERK_SECRET_KEY`, `CLERK_JWT_KEY`) foi versionada no repositório.
