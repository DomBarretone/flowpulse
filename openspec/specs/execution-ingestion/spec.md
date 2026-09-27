# execution-ingestion Specification

## Purpose

Define os requisitos e critérios de aceitação para o pipeline de ingestão de execuções externas (`POST /api/v1/executions`), a persistência da entidade relacional `Execution`, a garantia estrita de idempotência, a validação real de integração via eventos de teste (`is_test: true`) e a consulta do histórico de execuções.

## Requirements

### Requirement: Modelo relacional Execution e constraint de unicidade
O schema Prisma (`apps/api/prisma/schema.prisma`) SHALL conter o modelo `Execution` com os seguintes campos:
- `id`: UUID (PK);
- `automation_id`: UUID referenciando `Automation.id`;
- `external_execution_id`: String contendo o identificador da execução no sistema de origem;
- `status`: Enum `ExecutionStatus` (`RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`);
- `started_at`: DateTime informando o início da execução;
- `finished_at`: DateTime opcional informando o término da execução;
- `duration_ms`: Inteiro positivo opcional representando a duração em milissegundos;
- `error_message`: String opcional contendo a mensagem de erro (caso falhe);
- `is_test`: Boolean com valor padrão `false`;
- `created_at`: DateTime com valor padrão `now()`.

A entidade SHALL declarar a restrição única composta:
`@@unique([automation_id, external_execution_id])`

```prisma
enum ExecutionStatus {
  RUNNING
  SUCCESS
  FAILED
  TIMEOUT
}
```

#### Scenario: Persistência de execução válida
- **WHEN** um sistema externo envia dados de execução válidos
- **THEN** o registro é persistido na tabela `executions` com todos os metadados informados e associado à automação autenticada

#### Scenario: Bloqueio estrutural de duplicidade no banco
- **WHEN** uma tentativa de inserção com a mesma combinação de `automation_id` e `external_execution_id` ocorre no nível de banco de dados
- **THEN** a restrição única impede a criação de linha duplicada

### Requirement: Endpoint de ingestão de execuções com autoridade delegada à credencial
O backend SHALL prover o endpoint `POST /api/v1/executions` com as seguintes regras de segurança e validação:
1. Autenticado exclusivamente via cabeçalho `x-api-key` através do `ApiKeyGuard`.
2. A automação alvo é determinada estritamente a partir da credencial validada (`request.automation.id`).
3. O payload JSON NÃO pode ditar a `automation_id`; qualquer tentativa de enviar `automation_id` no corpo SHALL ser rejeitada pelo `ValidationPipe` (erro 422 RFC 7807) ou ignorada com descarte seguro.
4. Campos obrigatórios no DTO de entrada:
   - `external_execution_id`: string não-vazia;
   - `status`: enum válido (`RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`);
   - `started_at`: formato ISO 8601;
   - `is_test`: booleano (opcional, padrão `false`).
5. Campos opcionais: `finished_at`, `duration_ms`, `error_message`.
6. Campos desconhecidos são terminantemente rejeitados via `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.

#### Scenario: Ingestão de execução produtiva por sistema externo
- **GIVEN** uma automação ativa com credencial válida
- **WHEN** o sistema externo envia `POST /api/v1/executions` com dados válidos e `is_test: false`
- **THEN** o backend persiste a execução, retorna HTTP 201 Created contendo `execution_id` e confirma o processamento

#### Scenario: Rejeição de payload com dados inválidos ou campos extras
- **WHEN** o payload contém campos desconhecidos ou formato de data inválido
- **THEN** a requisição é rejeitada com HTTP 422 Unprocessable Entity no padrão RFC 7807 contendo `request_id`

### Requirement: Idempotência de recebimento de execuções
O endpoint `POST /api/v1/executions` SHALL ser estritamente idempotente em relação a reenvios acidentais ou retentativas de rede com o mesmo `external_execution_id` para a mesma automação:
1. Caso uma execução com a mesma combinação `(automation_id, external_execution_id)` já tenha sido gravada, o backend SHALL NÃO inserir uma nova linha na tabela `executions`.
2. O backend SHALL retornar o registro preexistente com status HTTP 200 OK (ou 201 idempotente) contendo os dados da execução e o eventual `incident_id` já gerado anteriormente.
3. Sob nenhuma circunstância o reenvio de uma execução duplicada SHALL gerar um novo `Incident`.

#### Scenario: Reenvio de execução já processada não duplica dados nem incidentes
- **GIVEN** uma execução externa já previamente recebida e persistida
- **WHEN** o sistema externo reenvia a mesma requisição com o mesmo `external_execution_id`
- **THEN** o backend responde com sucesso, retorna a referência da execução original e não cria novos registros nem incidentes duplicados

### Requirement: Validação real de integração por evento de teste
O endpoint de ingestão SHALL suportar a validação operacional da integração através de eventos de teste reais (`is_test: true`):
1. Quando uma execução é recebida com `is_test: true`:
   - A execução é gravada no banco com `is_test = true`.
   - O `integration_status` da automação correspondente é atualizado atômicamente para `VALIDATED`.
   - Execuções de teste SHALL NUNCA gerar incidentes, mesmo quando seu status for `FAILED` ou `TIMEOUT`.
2. Não SHALL existir nenhum endpoint alternativo ou artifício visual de frontend para forçar `VALIDATED` sem o tráfego do evento de teste real pela API com chave válida.

#### Scenario: Evento de teste transita integration_status para VALIDATED
- **GIVEN** uma automação recém-criada com `integration_status: PENDING`
- **WHEN** uma requisição válida é enviada para `POST /api/v1/executions` com `is_test: true` utilizando a chave da automação
- **THEN** a execução é gravada como teste, o `integration_status` da automação passa para `VALIDATED` e nenhum incidente é aberto

#### Scenario: Evento de teste com status FAILED não abre incidente
- **WHEN** uma requisição de teste é enviada com `is_test: true` e `status: FAILED`
- **THEN** a execução é persistida, a integração é validada como apta a se comunicar, e nenhum registro de `Incident` é criado

### Requirement: Consulta ao histórico de execuções
O backend SHALL prover o endpoint `GET /api/v1/executions`, protegido por `ClerkAuthGuard` e `RolesGuard` (`ADMIN` e `ANALYST`), permitindo consultar o histórico de execuções com suporte a paginação e filtros opcionais por `automation_id`, `status` e `is_test`.

#### Scenario: Usuário autenticado consulta execuções de uma automação
- **GIVEN** um usuário autenticado como `ADMIN` ou `ANALYST`
- **WHEN** envia requisição para `GET /api/v1/executions?automation_id={id}`
- **THEN** o backend retorna HTTP 200 OK com a lista de execuções ordenadas cronologicamente
