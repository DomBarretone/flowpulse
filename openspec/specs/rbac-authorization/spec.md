# rbac-authorization Specification

## Purpose

Define os requisitos observáveis para a autorização baseada em papéis (RBAC) no FlowPulse, compreendendo os papéis `ADMIN` e `ANALYST`, o provisionamento estrito e confiável de permissões a partir do backend, o decorator `@Roles()`, o guard `RolesGuard` e o tratamento padronizado de acesso negado (HTTP 403 RFC 7807).

## Requirements

### Requirement: Papéis de acesso formais (ADMIN e ANALYST)
A plataforma SHALL suportar formalmente os papéis `ADMIN` e `ANALYST` definidos no enum `Role`.
- `ADMIN`: privilégios de administração e parametrização.
- `ANALYST`: privilégios de monitoramento, triagem e resolução de incidentes.

#### Scenario: Atribuição de papéis suportados
- **WHEN** um usuário é persistido ou avaliado pelo sistema
- **THEN** seu papel corresponde estritamente a um dos valores do enum `Role`: `ADMIN` ou `ANALYST`

### Requirement: Provisionamento confiável de papéis no backend
A atribuição de papéis de usuários SHALL obedecer a regras estritas de autoridade exclusivas do backend:
1. Novos usuários cadastrados SHALL receber `Role.ANALYST` por padrão.
2. O papel `Role.ADMIN` SHALL ser concedido exclusivamente se o email do usuário constar na lista configurada no backend na variável de ambiente `FLOWPULSE_ADMIN_EMAILS` (emails autorizados separados por vírgula).
3. A correspondência de email para concessão de `ADMIN` SHALL exigir que o email seja o email primário e esteja explicitamente verificado no Clerk (`email_verified === true`).
4. O backend SHALL ignorar qualquer valor de role enviado pelo cliente no corpo da requisição ou cabeçalhos.
5. O backend SHALL nunca utilizar `unsafeMetadata` do cliente como fonte de autoridade para RBAC.

#### Scenario: Novo usuário comum recebe papel ANALYST
- **WHEN** um usuário com email não listado em `FLOWPULSE_ADMIN_EMAILS` autentica-se pela primeira vez
- **THEN** o sistema persiste o usuário com papel `ANALYST`

#### Scenario: Email autorizado e verificado recebe papel ADMIN
- **WHEN** um usuário autentica-se com email primário verificado que consta na lista `FLOWPULSE_ADMIN_EMAILS`
- **THEN** o sistema atribui e persiste o papel `ADMIN` para esse usuário

#### Scenario: Tentativa do cliente de definir role é ignorada
- **WHEN** uma requisição de cliente envia `{ "role": "ADMIN" }` ou define `unsafeMetadata.role = "ADMIN"`
- **THEN** o backend descarta o valor fornecido pelo cliente e determina o papel estritamente pelas regras confiáveis do servidor

### Requirement: Decorator declarativo @Roles()
O backend NestJS SHALL fornecer o decorator `@Roles(...roles: Role[])` que anota classes de controllers ou manipuladores de rota com os papéis autorizados para execução.

#### Scenario: Rota anota restrição de perfil
- **WHEN** uma rota é decorada com `@Roles(Role.ADMIN)`
- **THEN** os metadados da rota armazenam a restrição para inspeção em tempo de execução pelo `Reflector`

### Requirement: RolesGuard reutilizável e resposta HTTP 403 RFC 7807
O backend SHALL prover o guard NestJS `RolesGuard` (`CanActivate`). Quando aplicado em uma rota protegida:
1. O guard lê os papéis exigidos definidos via `@Roles()`.
2. Se nenhum papel for exigido, o guard SHALL conceder acesso a qualquer usuário autenticado (`return true`).
3. Se um ou mais papéis forem exigidos, o guard SHALL verificar se `request.user.role` é compatível.
4. Se compatível, o guard concede acesso (`return true`).
5. Se incompatível, o guard SHALL lançar `ForbiddenException`, retornando HTTP `403 Forbidden` no formato RFC 7807 (*Problem Details*) contendo `type`, `title`, `status`, `detail`, `instance` e `request_id`.

#### Scenario: Usuário ADMIN acessa rota restrita a ADMIN
- **WHEN** um usuário autenticado com `role: "ADMIN"` requisita uma rota com `@Roles(Role.ADMIN)`
- **THEN** o `RolesGuard` autoriza a execução e a requisição prossegue com HTTP 200

#### Scenario: Usuário ANALYST tenta acessar rota restrita a ADMIN
- **WHEN** um usuário autenticado com `role: "ANALYST"` requisita uma rota anotada com `@Roles(Role.ADMIN)`
- **THEN** o `RolesGuard` rejeita a requisição retornando HTTP `403 Forbidden` no padrão RFC 7807 contendo `request_id`

#### Scenario: Rota autenticada sem restrição de papéis
- **WHEN** um usuário autenticado acessa uma rota protegida por `ClerkAuthGuard` sem anotação `@Roles()`
- **THEN** o `RolesGuard` permite o acesso para qualquer usuário autenticado

### Requirement: Precedência de avaliação de segurança (401 antes de 403)
A segurança SHALL ser avaliada em cadeia estrita:
1. `ClerkAuthGuard` valida primeiro a integridade do token (retornando 401 se ausente ou inválido).
2. `RolesGuard` valida em seguida as permissões do usuário autenticado (retornando 403 se a permissão for insuficiente).

#### Scenario: Requisição sem token em rota protegida por role retorna 401
- **WHEN** uma requisição é enviada sem cabeçalho `Authorization` para uma rota anotada com `@Roles(Role.ADMIN)`
- **THEN** a requisição retorna HTTP `401 Unauthorized` (e não 403)
