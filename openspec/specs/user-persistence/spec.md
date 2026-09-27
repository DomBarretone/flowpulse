# user-persistence Specification

## Purpose

Define os requisitos observáveis para a persistência e sincronização confiável de usuários no PostgreSQL (Supabase) via Prisma ORM, contemplando a evolução da tabela `users` com o campo `clerk_user_id`, a geração de migration versionada, o serviço de sincronização idempotente baseado em dados verificados do IdP e os endpoints `GET /api/v1/users/me` e `POST /api/v1/users/sync`.

## Requirements

### Requirement: Evolução do modelo User com identificador único Clerk
O modelo `User` no schema Prisma (`apps/api/prisma/schema.prisma`) SHALL conter o atributo `clerk_user_id` do tipo `String` com restrição de unicidade (`@unique`), além dos campos preexistentes (`id`, `email`, `name`, `role`, `created_at`, `updated_at`).

```prisma
model User {
  id            String   @id @default(uuid())
  clerk_user_id String   @unique
  email         String   @unique
  name          String
  role          Role     @default(ANALYST)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@map("users")
}
```

#### Scenario: Geração do Prisma Client com clerk_user_id
- **WHEN** `npm run db:generate` é executado
- **THEN** o Prisma Client é gerado contendo o campo `clerk_user_id` único e métodos tipados de consulta

### Requirement: Migration Prisma versionada
Todas as alterações estruturais na tabela `users` SHALL ser aplicadas exclusivamente através de migrations versionadas geradas com `prisma migrate dev`. O uso de `prisma db push` é estritamente proibido.

#### Scenario: Execução de migration incremental
- **WHEN** `npm run db:migrate` é executado
- **THEN** uma migration SQL versionada é gerada e aplicada, adicionando a coluna `clerk_user_id` e o índice único sem perda de integridade

### Requirement: Sincronização confiável e idempotente (Clerk -> User)
O backend SHALL prover um serviço (`UsersService`) responsável por sincronizar a identidade do usuário com o banco PostgreSQL respeitando as seguintes regras:
1. `clerk_user_id` (`sub`) SHALL ser utilizado como identidade principal e imutável do usuário.
2. O backend SHALL NÃO confiar em endereços de email fornecidos no payload do frontend; todas as informações de email e verificação SHALL ser obtidas diretamente do token validado do Clerk ou da API oficial do Clerk no servidor.
3. A vinculação de uma conta preexistente na tabela `users` (por coincidência de email) SHALL ser permitida estritamente se o email for o email primário e estiver verificado no Clerk (`email_verified === true`).
4. A sincronização SHALL ser estritamente idempotente: múltiplas requisições com o mesmo `clerk_user_id` SHALL retornar o mesmo registro sem gerar duplicidade de linhas e sem violar constraints únicas.

#### Scenario: Primeiro acesso de usuário cria registro com base em dados confiáveis
- **WHEN** um usuário autentica-se pela primeira vez no Clerk com um `clerk_user_id` inédito
- **THEN** o `UsersService` cria o registro na tabela `users` com o `clerk_user_id`, email verificado, nome e role atribuído pelo backend

#### Scenario: Sincronizações repetidas preservam unicidade e idempotência
- **WHEN** um usuário com `clerk_user_id` já existente executa requisições repetidas
- **THEN** o sistema retorna o registro já persistido sem gerar novas linhas e sem lançar exceções de unicidade

#### Scenario: Vinculação por email existente restrita a email verificado
- **WHEN** um usuário autentica-se e seu email primário verificado coincide com um usuário preexistente (sem `clerk_user_id` registrado)
- **THEN** o sistema atualiza o registro preexistente preenchendo o `clerk_user_id`, mantendo seu `id` UUID original

### Requirement: Endpoint GET /api/v1/users/me
A API SHALL expor o endpoint `GET /api/v1/users/me` protegido por `ClerkAuthGuard`. O endpoint SHALL retornar os dados do perfil persistido do usuário autenticado no banco de dados, incluindo seu papel (`role`) oficial.

#### Scenario: Consulta de perfil do usuário autenticado
- **WHEN** um usuário autenticado envia `GET /api/v1/users/me` com Bearer JWT válido
- **THEN** a API responde com status `200 OK` e o JSON:
```json
{
  "id": "<uuid>",
  "clerk_user_id": "<clerk_user_id>",
  "email": "<email>",
  "name": "<name>",
  "role": "ADMIN" | "ANALYST",
  "created_at": "<iso_date>",
  "updated_at": "<iso_date>"
}
```

### Requirement: Endpoint POST /api/v1/users/sync
A API SHALL expor o endpoint `POST /api/v1/users/sync` protegido por `ClerkAuthGuard`, permitindo que clientes acionem explicitamente a sincronização de dados do usuário autenticado de forma idempotente.

#### Scenario: Chamada explícita de sincronização
- **WHEN** um cliente autenticado envia `POST /api/v1/users/sync`
- **THEN** o backend executa a sincronização confiável e retorna `200 OK` com o registro de usuário persistido
