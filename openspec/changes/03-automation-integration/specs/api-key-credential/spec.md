# Spec Delta: api-key-credential

## Purpose

Define os requisitos observáveis para a geração, armazenamento seguro, ciclo de vida e autenticação de chaves de integração (`ApiKey`) para sistemas externos, incluindo a geração de alta entropia criptográfica, exibição estritamente única do segredo gerado, armazenamento exclusivo de hash SHA-256 e o `ApiKeyGuard` responsável por proteger endpoints de máquina.

---

## ADDED Requirements

### Requirement: Modelo relacional ApiKey e armazenamento seguro de hashes
O schema Prisma (`apps/api/prisma/schema.prisma`) SHALL conter a entidade `ApiKey` com os seguintes campos:
- `id`: UUID (PK);
- `automation_id`: UUID referenciando `Automation.id`;
- `key_hash`: String única com o hash criptográfico SHA-256 da chave completa;
- `prefix`: String contendo identificador público seguro para exibição (e.g. `fp_live_...`);
- `created_at`: DateTime (default now());
- `revoked_at`: DateTime opcional indicando a data/hora da revogação;
- `last_used_at`: DateTime opcional indicando o último uso com sucesso.

O banco de dados SHALL NUNCA armazenar a chave em texto plano.

#### Scenario: Persistência exclusiva do hash SHA-256
- **WHEN** uma credencial de integração é gerada e persistida no banco de dados
- **THEN** a tabela `api_keys` armazena exclusivamente o hash SHA-256 e o prefixo seguro de exibição, jamais o segredo original em texto claro

#### Scenario: Unicidade do hash de chave
- **WHEN** uma nova chave é inserida
- **THEN** a restrição única `@unique` sobre `key_hash` garante que nenhuma duplicidade colidente de chave possa coexistir

---

### Requirement: Emissão de chaves de máquina e revelação estritamente única
O backend SHALL disponibilizar o endpoint `POST /api/v1/automations/:id/api-keys`, restrito a usuários com papel `ADMIN`:
1. O backend gera um token com entropia criptográfica forte (mínimo de 32 bytes pseudoaleatórios via `crypto.randomBytes()`) formatado como:
   `fp_live_<64_caracteres_hex>`
2. O backend computa o hash SHA-256 do token completo e persiste na tabela `api_keys`.
3. A resposta HTTP 201 Created devolve o segredo completo **uma única vez** no corpo da resposta:
   ```json
   {
     "id": "uuid-da-chave",
     "prefix": "fp_live_e4d9...",
     "secret": "fp_live_e4d909c290d0fb1ca068ffaddf22cbd0ffd829efe1823f802917112ea1bc6432",
     "created_at": "2026-09-27T19:30:00.000Z"
   }
   ```
4. Endpoints de leitura subsequentes (`GET /api/v1/automations/:id`) SHALL listar apenas `id`, `prefix`, `created_at`, `revoked_at` e `last_used_at`, NUNCA expondo o campo `secret` ou `key_hash`.
5. Logs do backend, erros e traces SHALL NUNCA registrar o valor do segredo.

#### Scenario: Administrador gera credencial de integração
- **GIVEN** um usuário autenticado como `ADMIN`
- **WHEN** chama `POST /api/v1/automations/:id/api-keys`
- **THEN** a resposta contém o segredo em texto puro `fp_live_...` e o registro persistido contém apenas o SHA-256 correspondente

#### Scenario: Segredo não reaparece em consultas posteriores
- **GIVEN** uma credencial previamente gerada
- **WHEN** qualquer usuário consulta a automação via `GET /api/v1/automations/:id`
- **THEN** os metadados da chave exibem apenas o prefixo mascarado, sem o campo `secret` e sem o hash completo

---

### Requirement: Revogação imediata de credencial
O backend SHALL prover o endpoint `POST /api/v1/automations/:id/api-keys/:keyId/revoke`, acessível exclusivamente pelo papel `ADMIN`:
1. O endpoint atualiza o campo `revoked_at` para a data/hora atual.
2. A revogação SHALL ter efeito imediato, invalidando qualquer tentativa subsequente de autenticação com a chave correspondente.

#### Scenario: Administrador revoga credencial ativa
- **GIVEN** uma chave de API válida e ativa
- **WHEN** um `ADMIN` aciona a revogação via `POST /api/v1/automations/:id/api-keys/:keyId/revoke`
- **THEN** o status da chave transita para revogada (`revoked_at != null`) e a API responde HTTP 200 OK

---

### Requirement: ApiKeyGuard para autenticação de sistemas externos
O backend SHALL implementar o `ApiKeyGuard` em `apps/api/src/common/guards/api-key.guard.ts` para proteger o endpoint de ingestão de execuções:
1. Extrai o cabeçalho `x-api-key` da requisição HTTP.
2. Rejeita ausência do cabeçalho ou formato que não inicie com `fp_live_` retornando HTTP 401 Unauthorized no padrão RFC 7807 contendo `request_id`.
3. Calcula o hash SHA-256 do valor recebido.
4. Consulta a tabela `api_keys` buscando correspondência exata onde `revoked_at IS NULL`.
5. Se não houver registro correspondente ou se a chave estiver revogada, retorna HTTP 401 Unauthorized RFC 7807.
6. Injeta a automação vinculada (`request.automation`) e os dados da chave (`request.apiKey`) no contexto da requisição.
7. Atualiza o timestamp `last_used_at` da chave.
8. Não utiliza e não depende de nenhuma sessão ou token do Clerk.

#### Scenario: Autenticação bem-sucedida via chave válida
- **GIVEN** uma chave de integração ativa e não revogada
- **WHEN** um sistema externo envia requisição com cabeçalho `x-api-key` contendo a chave correta
- **THEN** o `ApiKeyGuard` autoriza a execução, vincula a automação correta à requisição e atualiza `last_used_at`

#### Scenario: Rejeição de requisição sem cabeçalho x-api-key
- **WHEN** uma requisição é enviada a endpoint protegido por `ApiKeyGuard` sem o cabeçalho `x-api-key`
- **THEN** o `ApiKeyGuard` interrompe a execução com HTTP 401 Unauthorized RFC 7807 contendo `request_id`

#### Scenario: Rejeição de chave revogada ou inválida
- **WHEN** uma requisição é enviada contendo uma chave inexistente ou com `revoked_at` preenchido
- **THEN** o `ApiKeyGuard` rejeita a requisição com HTTP 401 Unauthorized RFC 7807 contendo `request_id`
