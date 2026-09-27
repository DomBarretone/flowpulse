# Spec Delta: automation-management

## Purpose

Define os requisitos e cenários de aceitação para o gerenciamento de automações no FlowPulse, contemplando a entidade relacional `Automation`, validações estritas de domínio, enums de estado e criticidade, controle RBAC (`ADMIN` vs `ANALYST`) e regras de transição de monitoramento (`activate`/`deactivate`).

---

## ADDED Requirements

### Requirement: Modelo relacional e enums da entidade Automation
O modelo `Automation` no schema Prisma (`apps/api/prisma/schema.prisma`) SHALL conter os campos:
- `id`: UUID (PK);
- `name`: String não vazia;
- `description`: String opcional;
- `owner_id`: UUID referenciando uma chave primária válida da tabela `users`;
- `criticality`: Enum `Criticality` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`);
- `expected_duration_seconds`: Inteiro estritamente positivo (> 0);
- `status`: Enum `AutomationStatus` (`DRAFT`, `ACTIVE`, `INACTIVE`), com valor padrão `DRAFT`;
- `integration_status`: Enum `IntegrationStatus` (`PENDING`, `VALIDATED`, `FAILED`), com valor padrão `PENDING`;
- `created_at`: DateTime (default now());
- `updated_at`: DateTime (auto updated).

```prisma
enum Criticality {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AutomationStatus {
  DRAFT
  ACTIVE
  INACTIVE
}

enum IntegrationStatus {
  PENDING
  VALIDATED
  FAILED
}
```

#### Scenario: Criação de nova automação assume estados iniciais padronizados
- **WHEN** uma automação é cadastrada com sucesso através da API
- **THEN** o registro persistido no banco possui `status: DRAFT` e `integration_status: PENDING`

#### Scenario: Rejeição de duração esperada não positiva
- **WHEN** uma requisição de criação ou atualização informa `expected_duration_seconds <= 0` ou valor não inteiro
- **THEN** a API rejeita a operação com status HTTP 422 (*Unprocessable Entity*) no padrão RFC 7807

#### Scenario: Integridade referencial com usuário proprietário
- **WHEN** uma automação é cadastrada informando `owner_id` inexistente na tabela `users`
- **THEN** o banco de dados e a camada de serviço impedem a criação e retornam erro de validação referencial

---

### Requirement: Endpoints REST para criação, consulta e edição de Automações
O backend SHALL disponibilizar endpoints sob `/api/v1/automations` protegidos por `ClerkAuthGuard` e `RolesGuard`:
1. `POST /api/v1/automations`: permite cadastro de nova automação (acesso exclusivo `ADMIN`).
2. `GET /api/v1/automations`: lista automações cadastradas com paginação e filtros por status e criticidade (acesso `ADMIN` e `ANALYST`).
3. `GET /api/v1/automations/:id`: retorna os detalhes completos de uma automação (acesso `ADMIN` e `ANALYST`).
4. `PATCH /api/v1/automations/:id`: atualiza dados cadastrais (`name`, `description`, `criticality`, `expected_duration_seconds`) rejeitando campos desconhecidos via `ValidationPipe` (acesso exclusivo `ADMIN`).

#### Scenario: Administrador cadastra nova automação
- **GIVEN** um usuário autenticado com perfil `ADMIN`
- **WHEN** envia requisição válida para `POST /api/v1/automations`
- **THEN** o sistema retorna HTTP 201 Created com os dados da automação criada, incluindo `id`, `status: DRAFT` e `integration_status: PENDING`

#### Scenario: Analista tenta criar automação
- **GIVEN** um usuário autenticado com perfil `ANALYST`
- **WHEN** envia requisição para `POST /api/v1/automations`
- **THEN** o sistema rejeita a operação com HTTP 403 Forbidden RFC 7807 contendo `request_id`

#### Scenario: Usuário sem autenticação tenta acessar automações
- **WHEN** qualquer requisição sem token JWT válido é enviada para `/api/v1/automations`
- **THEN** o sistema responde com HTTP 401 Unauthorized RFC 7807 contendo `request_id`

---

### Requirement: Ativação e Desativação de Monitoramento
O backend SHALL prover os endpoints:
- `POST /api/v1/automations/:id/activate`: transita o status da automação para `ACTIVE`, restrito ao papel `ADMIN`.
- `POST /api/v1/automations/:id/deactivate`: transita o status da automação para `INACTIVE`, restrito ao papel `ADMIN`.

A ativação SHALL ser estritamente bloqueada se o `integration_status` da automação for diferente de `VALIDATED`.

#### Scenario: Tentativa de ativar automação sem teste prévio validado
- **GIVEN** uma automação com `integration_status: PENDING` ou `integration_status: FAILED`
- **WHEN** um `ADMIN` envia requisição para `POST /api/v1/automations/:id/activate`
- **THEN** o backend rejeita a transição com HTTP 422 (*Unprocessable Entity*) ou 409 (*Conflict*) informando que a automação requer um teste de integração validado com sucesso antes de ser ativada

#### Scenario: Ativação bem-sucedida de automação com integração validada
- **GIVEN** uma automação cujo `integration_status` foi atualizado para `VALIDATED`
- **WHEN** um `ADMIN` envia requisição para `POST /api/v1/automations/:id/activate`
- **THEN** o backend atualiza o status para `ACTIVE` e retorna HTTP 200 OK com o registro atualizado

#### Scenario: Desativação de monitoramento por administrador
- **GIVEN** uma automação em status `ACTIVE`
- **WHEN** um `ADMIN` envia requisição para `POST /api/v1/automations/:id/deactivate`
- **THEN** o backend atualiza o status para `INACTIVE` e retorna HTTP 200 OK
