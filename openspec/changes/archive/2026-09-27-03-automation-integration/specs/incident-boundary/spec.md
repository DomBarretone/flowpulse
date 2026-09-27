# Spec Delta: incident-boundary

## Purpose

Define os requisitos e a fronteira arquitetural mínima para a criação automática de incidentes em status `OPEN` a partir de execuções reais com falha (`status: FAILED`), estabelecendo o contrato de dados e a regra determinística de derivação de severidade que servirá de entrada direta para a change 04 (Tratamento de Incidentes).

---

## ADDED Requirements

### Requirement: Modelo relacional mínimo da entidade Incident
O schema Prisma (`apps/api/prisma/schema.prisma`) SHALL conter o modelo `Incident` com os seguintes campos:
- `id`: UUID (PK);
- `automation_id`: UUID referenciando `Automation.id`;
- `execution_id`: UUID referenciando `Execution.id` com restrição de unicidade (`@unique`), garantindo relação 1:1 entre a execução causadora e o incidente inicial;
- `status`: Enum `IncidentStatus` (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`), onde neste change a aplicação produz estritamente instâncias com status `OPEN`;
- `severity`: Enum `IncidentSeverity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`);
- `opened_at`: DateTime informando a data/hora de abertura do incidente (default `now()`);
- `created_at`: DateTime (default `now()`);
- `updated_at`: DateTime (auto updated).

```prisma
enum IncidentStatus {
  OPEN
  ACKNOWLEDGED
  INVESTIGATING
  RESOLVED
}

enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

#### Scenario: Estrutura relacional de incidente gerada no banco
- **WHEN** a migration Prisma é executada
- **THEN** a tabela `incidents` é criada contendo as chaves estrangeiras para `automations` e `executions`, com índice único em `execution_id`

---

### Requirement: Criação automática de Incidente OPEN para execução com falha
O backend SHALL instanciar e persistir automaticamente um registro na tabela `incidents` quando e somente quando TODAS as seguintes condições forem satisfeitas:
1. A execução for produtiva: `is_test === false`.
2. O status da execução for `FAILED`.
3. A automação estiver ativa: `automation.status === AutomationStatus.ACTIVE`.

O incidente SHALL ser persistido com status inicial `IncidentStatus.OPEN` e vinculado à execução correspondente.

Nesta change, nenhuma lógica de transição de status (`ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`), assunção de analista, chamada à IA ou registro de notas de resolução SHALL ser implementada.

#### Scenario: Execução real com falha em automação ativa cria incidente OPEN
- **GIVEN** uma automação com `status: ACTIVE`
- **WHEN** uma execução é recebida com `is_test: false` e `status: FAILED`
- **THEN** um registro na tabela `incidents` é criado com status `OPEN`, vinculado à automação e à execução, e o `incident_id` é retornado na resposta da API

#### Scenario: Execução bem-sucedida não cria incidente
- **GIVEN** uma automação ativa
- **WHEN** uma execução com `is_test: false` e `status: SUCCESS` é recebida
- **THEN** a execução é persistida e nenhum registro de `Incident` é gerado

#### Scenario: Execução com falha em automação inativa ou em draft não cria incidente
- **GIVEN** uma automação com `status: DRAFT` ou `status: INACTIVE`
- **WHEN** uma execução chega ao sistema
- **THEN** nenhum incidente é gerado (e requisições produtivas em draft/inativa são rejeitadas conforme regras de estado)

---

### Requirement: Regra determinística de derivação de severidade
A severidade inicial do incidente (`Incident.severity`) SHALL ser calculada de forma puramente determinística e isolada a partir da criticidade configurada na automação (`Automation.criticality`):

| Automation.criticality | Execution.status | Incident.severity |
|---|---|---|
| `CRITICAL` | `FAILED` | `CRITICAL` |
| `HIGH` | `FAILED` | `CRITICAL` |
| `MEDIUM` | `FAILED` | `HIGH` |
| `LOW` | `FAILED` | `MEDIUM` |

A função de cálculo SHALL ser implementada como serviço puro e testada unitariamente com 100% de cobertura sobre todas as variações de enum.

#### Scenario: Cálculo de severidade para automação CRITICAL
- **WHEN** uma execução falha em automação de criticidade `CRITICAL`
- **THEN** o incidente é criado com severidade `CRITICAL`

#### Scenario: Cálculo de severidade para automação HIGH
- **WHEN** uma execução falha em automação de criticidade `HIGH`
- **THEN** o incidente é criado com severidade `CRITICAL`

#### Scenario: Cálculo de severidade para automação MEDIUM
- **WHEN** uma execução falha em automação de criticidade `MEDIUM`
- **THEN** o incidente é criado com severidade `HIGH`

#### Scenario: Cálculo de severidade para automação LOW
- **WHEN** uma execução falha em automação de criticidade `LOW`
- **THEN** o incidente é criado com severidade `MEDIUM`

---

### Requirement: Prevenção estrita de incidentes duplicados e incidentes de teste
O sistema SHALL garantir de forma inviolável:
1. Execuções com `is_test: true` NUNCA criam registros em `incidents`, independentemente do status informado.
2. O reenvio de uma execução com o mesmo `external_execution_id` já existente NUNCA cria um segundo registro em `incidents`. Caso a execução original já tenha um incidente aberto associado, o identificador do incidente existente é retornado sem novas inserções.

#### Scenario: Execução de teste com status FAILED é isolada de incidentes
- **WHEN** uma execução é ingerida com `is_test: true` e `status: FAILED`
- **THEN** a execução é gravada para validar a integração e zero incidentes são criados

#### Scenario: Reenvio de evento de erro não duplica incidente
- **GIVEN** que uma execução FAILED já gerou um incidente `inc-123`
- **WHEN** o mesmo evento é reenviado com o mesmo `external_execution_id`
- **THEN** o backend retorna `inc-123` sem inserir novas linhas na tabela `incidents`
