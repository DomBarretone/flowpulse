# Spec Delta: auth-clerk

## Purpose

Define os requisitos observáveis para a integração de autenticação via Clerk no FlowPulse, englobando a configuração do cliente no frontend Next.js 15, proteção de rotas privadas próximo ao recurso (sem APIs depreciadas), controle de sessão/logout, validação criptográfica de tokens JWT no backend NestJS (suportando `CLERK_SECRET_KEY` e `CLERK_JWT_KEY`) e consumo server-side de identidade no Dashboard.

---

## ADDED Requirements

### Requirement: Frontend ClerkProvider e configuração canônica de variáveis
O frontend Next.js (`apps/web`) SHALL encapsular a aplicação com `<ClerkProvider>` no layout raiz (`src/app/layout.tsx`), consumindo as variáveis canônicas atuais:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard`

O uso das variáveis depreciadas `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` e `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` SHALL ser expressamente evitado. Nenhuma chave secreta SHALL ser exposta no frontend.

#### Scenario: Aplicação carrega com ClerkProvider e variáveis atuais
- **WHEN** a aplicação frontend é carregada no navegador
- **THEN** o contexto de autenticação do Clerk é inicializado utilizando as variáveis canônicas de redirecionamento sem warnings de depreciação no console

---

### Requirement: Frontend Proteção de rotas em Next.js 15 sem createRouteMatcher
O frontend SHALL manter `src/middleware.ts` executando `clerkMiddleware()` para repasse e sincronização de sessão sem utilizar a API depreciada `createRouteMatcher()`.
- A rota raiz `/` SHALL ser pública.
- As rotas `/sign-in` e `/sign-up` SHALL ser públicas.
- A proteção das rotas privadas (`/(protected)` e `/dashboard`) SHALL ser realizada próximo ao recurso, no layout `src/app/(protected)/layout.tsx`, utilizando `await auth.protect()`.

#### Scenario: Acesso anônimo a rota privada /dashboard é redirecionado
- **WHEN** um usuário não autenticado tenta acessar `/dashboard` ou qualquer rota sob `/(protected)`
- **THEN** o layout protegido aciona `auth.protect()` e redireciona a requisição para a página `/sign-in`

#### Scenario: Acesso anônimo à rota raiz / é permitido
- **WHEN** um usuário não autenticado acessa a rota `/`
- **THEN** a página pública é renderizada normalmente com status do sistema e opções de entrada

#### Scenario: Acesso anônimo às páginas de login e cadastro é permitido
- **WHEN** um usuário não autenticado acessa `/sign-in` ou `/sign-up`
- **THEN** os componentes de autenticação do Clerk são renderizados sem bloqueio ou loop de redirecionamento

---

### Requirement: Identificação de sessão e controle de logout
Em áreas autenticadas, o frontend SHALL exibir a identidade do usuário conectado e disponibilizar controle explícito para encerramento de sessão via `<UserButton />` ou `signOut()`.

#### Scenario: Usuário autenticado encerra sessão com sucesso
- **WHEN** um usuário conectado aciona o controle de logout
- **THEN** a sessão no Clerk é revogada e o usuário é redirecionado para rota pública

---

### Requirement: Consumo server-side de perfil na página /dashboard
A página protegida `/dashboard` SHALL ser um Server Component que obrigatoriamente consome o endpoint `GET /api/v1/users/me` utilizando o session token do Clerk (`Bearer <token>`) obtido no servidor.
O papel (`ADMIN` ou `ANALYST`) exibido na interface SHALL ser o papel retornado pelo backend (persistido no banco relacional), e não obtido de metadados não confiáveis do cliente.

#### Scenario: Dashboard renderiza com papel persistido
- **WHEN** um usuário autenticado acessa `/dashboard`
- **THEN** a página obtém o perfil via chamada server-side a `GET /api/v1/users/me` e renderiza o papel persistido no banco de dados

---

### Requirement: Backend Clerk JWT Validation com suporte a CLERK_JWT_KEY
O backend NestJS (`apps/api`) SHALL validar tokens JWT emitidos pelo Clerk presentes no cabeçalho HTTP `Authorization: Bearer <token>`. A validação SHALL verificar assinatura e validade utilizando `@clerk/backend`, aceitando:
1. `CLERK_SECRET_KEY`: chave secreta para comunicação com a API do Clerk;
2. `CLERK_JWT_KEY`: chave pública para verificação criptográfica local imediata do token sem requisições de rede.

#### Scenario: Token JWT válido é aceito
- **WHEN** uma requisição chega com um cabeçalho `Authorization: Bearer <valid_jwt>`
- **THEN** a assinatura do token é confirmada com sucesso pelo backend e a requisição prossegue

#### Scenario: Token JWT ausente é rejeitado
- **WHEN** uma requisição a um endpoint protegido é enviada sem o cabeçalho `Authorization`
- **THEN** o backend rejeita a requisição com HTTP `401 Unauthorized` (RFC 7807)

#### Scenario: Token JWT expirado ou inválido é rejeitado
- **WHEN** uma requisição é enviada com token expirado, assinatura inválida ou sem o prefixo `Bearer `
- **THEN** o backend rejeita a requisição com HTTP `401 Unauthorized` (RFC 7807)

---

### Requirement: ClerkAuthGuard reutilizável e decorator @CurrentUser()
O backend SHALL prover um guard NestJS `ClerkAuthGuard` (`CanActivate`) e um decorator `@CurrentUser()`. Quando a validação do token é bem-sucedida, o guard SHALL extrair a identidade do usuário e anexar a entidade de usuário persistida no banco a `request.user`.

#### Scenario: Injeção de identidade validada no controller
- **WHEN** uma requisição passa com sucesso pelo `ClerkAuthGuard`
- **THEN** os métodos de controller que utilizam `@CurrentUser()` recebem os dados do usuário autenticado persistido no banco

---

### Requirement: Isolamento de credenciais e integridade de logs
A aplicação SHALL garantir que:
1. `CLERK_SECRET_KEY` e `CLERK_JWT_KEY` permaneçam restritas ao backend e nunca sejam versionadas em repositório.
2. Tokens JWT, cabeçalhos de autorização e credenciais nunca sejam impressos em logs de execução (stdout ou arquivos).
3. O frontend nunca conecte diretamente ao PostgreSQL ou utilize a Supabase Data API.

#### Scenario: Logs não vazam dados sensíveis
- **WHEN** o backend processa requisições contendo cabeçalhos de autorização
- **THEN** os logs emitidos não contêm o valor do token JWT, segredos ou dados sensíveis
