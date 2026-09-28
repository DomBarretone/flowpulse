# incident-lifecycle Specification

## Purpose

Define os requisitos, regras de negócio e restrições técnicas para a evolução da entidade `Incident`, a máquina de estados linear determinística, a concorrência atômica, a governança de atribuição e ownership (RBAC) e a resolução obrigatória com notas explicativas para o ciclo de vida de incidentes operacionais do FlowPulse.

## Requirements

### Requirement: Extensão do modelo relacional da entidade Incident
O schema Prisma (`apps/api/prisma/schema.prisma`) SHALL evoluir o modelo `Incident` adicionando os seguintes campos de ciclo de vida com compatibilidade retroativa para registros pré-existentes:
- `assigned_to_id`: String nullable, chave estrangeira para `users.id` com política `onDelete: SetNull`;
- `acknowledged_at`: DateTime nullable, gravando a data/hora em que o incidente foi assumido;
- `investigating_at`: DateTime nullable, gravando a data/hora do início da investigação;
- `resolved_at`: DateTime nullable, gravando a data/hora em que o incidente foi concluído;
- `resolution_notes`: String nullable com anotação `@db.Text`, armazenando a justificativa técnica da resolução.

Os campos originais (`id`, `automation_id`, `execution_id`, `status`, `severity`, `opened_at`, `created_at`, `updated_at`) SHALL ser integralmente preservados. A migration correspondente SHALL ser versionada via `prisma migrate dev`.

#### Scenario: Execução de migration incremental sobre banco existente
- **GIVEN** que o banco de dados contém incidentes com status `OPEN` gerados pela change 03
- **WHEN** a migration `add_incident_lifecycle_and_ai_analyses` é executada
- **THEN** as novas colunas são adicionadas como `nullable` e os incidentes existentes permanecem válidos e consultáveis com seus dados preservados

---

### Requirement: Máquina de estados linear estrita
O sistema SHALL permitir SOMENTE as seguintes transições lineares de status no ciclo de vida do incidente:
1. `OPEN → ACKNOWLEDGED`
2. `ACKNOWLEDGED → INVESTIGATING`
3. `INVESTIGATING → RESOLVED`

O sistema SHALL proibir e rejeitar qualquer tentativa de:
- Pular estados (`OPEN → INVESTIGATING`, `OPEN → RESOLVED`, `ACKNOWLEDGED → RESOLVED`);
- Retroceder estados (`RESOLVED → OPEN`, `INVESTIGATING → ACKNOWLEDGED`, `INVESTIGATING → OPEN`, `ACKNOWLEDGED → OPEN`);
- Repetir a mesma transição (`ACKNOWLEDGED → ACKNOWLEDGED`, `INVESTIGATING → INVESTIGATING`, `RESOLVED → RESOLVED`);
- Transicionar qualquer incidente que já se encontre em `RESOLVED`.

Qualquer tentativa de transição proibida SHALL ser rejeitada com código HTTP `409 Conflict` no formato RFC 7807 contendo `request_id` e a explicação da transição ilegal.

#### Scenario: Transição linear bem-sucedida de OPEN para ACKNOWLEDGED
- **GIVEN** um incidente existente com status `OPEN`
- **WHEN** uma requisição de assunção é enviada
- **THEN** o status é atualizado para `ACKNOWLEDGED` e o timestamp `acknowledged_at` é registrado

#### Scenario: Transição linear bem-sucedida de ACKNOWLEDGED para INVESTIGATING
- **GIVEN** um incidente com status `ACKNOWLEDGED` operado pelo analista responsável ou administrador
- **WHEN** uma requisição de início de investigação é enviada
- **THEN** o status é atualizado para `INVESTIGATING` e o timestamp `investigating_at` é registrado

#### Scenario: Transição linear bem-sucedida de INVESTIGATING para RESOLVED
- **GIVEN** um incidente com status `INVESTIGATING` operado pelo analista responsável ou administrador com `resolution_notes` válidas
- **WHEN** uma requisição de resolução é enviada
- **THEN** o status é atualizado para `RESOLVED`, o timestamp `resolved_at` é registrado e as notas são salvas

#### Scenario: Rejeição de salto de estado de OPEN diretamente para RESOLVED
- **GIVEN** um incidente com status `OPEN`
- **WHEN** uma requisição tenta resolver o incidente diretamente
- **THEN** a API responde com HTTP `409 Conflict` Problem Details RFC 7807 e o status permanece `OPEN`

#### Scenario: Rejeição de transição em incidente já RESOLVED
- **GIVEN** um incidente com status `RESOLVED`
- **WHEN** qualquer endpoint de transição é invocado para o incidente
- **THEN** a API responde com HTTP `409 Conflict` e o incidente permanece imutável em `RESOLVED`

---

### Requirement: Concorrência atômica segura nas transições de estado
As mutações de status do incidente SHALL ser executadas de forma atomicamente protegida no banco de dados através de estratégia equivalente a update condicional:
```sql
UPDATE incidents SET status = :to_status, ... WHERE id = :id AND status = :expected_from_status
```
Caso duas requisições concorrentes tentem transicionar o mesmo incidente simultaneamente:
1. Exatamente uma requisição SHALL obter êxito na atualização atômica (`count === 1`);
2. A requisição concorrente SHALL detectar `count === 0` e retornar imediatamente HTTP `409 Conflict` (RFC 7807);
3. Em nenhuma hipótese o banco SHALL permitir atribuição ambígua de responsáveis, múltiplos vencedores ou estados inconsistentes.

#### Scenario: Duas requisições concorrentes tentam assumir o mesmo incidente OPEN
- **GIVEN** um incidente em status `OPEN`
- **WHEN** dois usuários enviam simultaneamente requisições para assumir o incidente (`POST /acknowledge`)
- **THEN** exatamente uma requisição recebe `200 OK` tornando o usuário responsável, enquanto a outra recebe `409 Conflict` RFC 7807

---

### Requirement: Atribuição por assunção (Claim) e governança de propriedade (Ownership)
A transição `OPEN → ACKNOWLEDGED` SHALL constituir o ato formal de assunção do incidente.
O backend SHALL:
1. Extrair a identidade do usuário autenticado a partir do token de sessão validado;
2. Gravar o identificador desse usuário em `assigned_to_id`;
3. Rejeitar qualquer campo `assigned_to_id` arbitrário fornecido no corpo da requisição pelo cliente.

As regras de autorização para as etapas subsequentes do ciclo SHALL obedecer estritamente aos papéis RBAC:
- **ANALYST**:
  - Pode assumir qualquer incidente em status `OPEN`;
  - Após a assunção, pode acionar `/investigate`, `/ai-analysis` e `/resolve` SOMENTE sobre incidentes onde `assigned_to_id === request.user.id`;
  - Se um analista tentar invocar `/investigate`, `/ai-analysis` ou `/resolve` em um incidente atribuído a outro analista, a requisição SHALL ser rejeitada com HTTP `403 Forbidden` RFC 7807.
- **ADMIN**:
  - Pode assumir, investigar, solicitar análise de IA e resolver QUALQUER incidente independentemente de quem seja o responsável atribuído.

#### Scenario: Analista assume incidente OPEN com sucesso
- **GIVEN** um usuário autenticado com papel `ANALYST` e um incidente em status `OPEN`
- **WHEN** o analista invoca `POST /api/v1/incidents/:id/acknowledge`
- **THEN** o incidente transita para `ACKNOWLEDGED` e `assigned_to_id` recebe o identificador do analista

#### Scenario: Analista tenta investigar incidente atribuído a outro usuário
- **GIVEN** um incidente em status `ACKNOWLEDGED` atribuído ao Usuário A
- **WHEN** o Usuário B (papel `ANALYST`) invoca `POST /api/v1/incidents/:id/investigate`
- **THEN** a requisição é rejeitada com HTTP `403 Forbidden` Problem Details RFC 7807

#### Scenario: Administrador investiga incidente atribuído a outro analista
- **GIVEN** um incidente em status `ACKNOWLEDGED` atribuído a um analista
- **WHEN** um usuário com papel `ADMIN` invoca `POST /api/v1/incidents/:id/investigate`
- **THEN** a requisição é processada com sucesso e o status avança para `INVESTIGATING`

---

### Requirement: Resolução obrigatória com notas explicativas (Resolution Notes)
O endpoint `POST /api/v1/incidents/:id/resolve` SHALL exigir obrigatoriamente no corpo da requisição o campo `resolution_notes`.
As notas de resolução:
1. SHALL ser uma string não vazia e não composta apenas por espaços em branco;
2. SHALL conter no mínimo 10 caracteres e no máximo 2000 caracteres;
3. Se ausente, vazia ou inválida, a requisição SHALL ser rejeitada com HTTP `422 Unprocessable Entity` (ou `400 Bad Request` conforme o filtro RFC 7807 global) sem alterar o status do incidente.

#### Scenario: Resolução com notas explicativas válidas
- **GIVEN** um incidente em status `INVESTIGATING` e o analista responsável autenticado
- **WHEN** uma requisição `POST /api/v1/incidents/:id/resolve` é enviada com `{ "resolution_notes": "Reiniciado o worker de fila e reprocessada a mensagem com payload corrigido." }`
- **THEN** o status avança para `RESOLVED`, `resolved_at` é preenchido com a data/hora atual e as notas são persistidas

#### Scenario: Tentativa de resolução sem notas explicativas
- **GIVEN** um incidente em status `INVESTIGATING`
- **WHEN** uma requisição `POST /api/v1/incidents/:id/resolve` é enviada com corpo vazio `{}` ou `{ "resolution_notes": "   " }`
- **THEN** a API rejeita a requisição com HTTP `422` Problem Details RFC 7807 e o incidente permanece em status `INVESTIGATING`

---

### Requirement: Endpoints RESTful para ciclo de vida de incidentes
O backend SHALL disponibilizar os seguintes endpoints sob `/api/v1/incidents`, protegidos por `ClerkAuthGuard` e `RolesGuard`:
1. `GET /api/v1/incidents`: Listagem paginada de incidentes com suporte a filtros: `status`, `severity`, `automation_id`, `assigned_to_id`, `page` e `limit`. Acesso concedido a `ADMIN` e `ANALYST`.
2. `GET /api/v1/incidents/:id`: Detalhes completos do incidente com entidades associadas (`automation`, `execution`, `assigned_to`). Acesso concedido a `ADMIN` e `ANALYST`.
3. `POST /api/v1/incidents/:id/acknowledge`: Transição de assunção do incidente. Acesso concedido a `ADMIN` e `ANALYST`.
4. `POST /api/v1/incidents/:id/investigate`: Transição de início de investigação. Acesso concedido a `ADMIN` e `ANALYST` (com regra de ownership).
5. `POST /api/v1/incidents/:id/resolve`: Transição de conclusão com `resolution_notes`. Acesso concedido a `ADMIN` e `ANALYST` (com regra de ownership).

#### Scenario: Listagem de incidentes com filtro por status
- **GIVEN** múltiplos incidentes com diferentes status no banco
- **WHEN** um usuário autenticado faz `GET /api/v1/incidents?status=OPEN`
- **THEN** a API retorna `200 OK` contendo apenas os incidentes em status `OPEN` com meta-informações de paginação
