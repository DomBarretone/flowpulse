# Especificação Técnica do Produto

## 1. Visão Geral

O FlowPulse é uma aplicação web voltada ao monitoramento e tratamento de incidentes relacionados a automações e pipelines.

Esta especificação transforma os requisitos do PRD em comportamentos, regras e contratos que poderão orientar a implementação.

O MVP deverá suportar dois fluxos de negócio completos:

1. **Integração de uma automação ao monitoramento.**
2. **Tratamento de um incidente desde a execução com problema até a resolução.**

A análise assistida por IA faz parte do segundo fluxo e será implementada de forma funcional, utilizando um modelo de linguagem externo.

---

## 2. Atores

### ADMIN

Pode:

- cadastrar e editar automações;
- gerar e revogar credenciais de integração;
- ativar ou desativar monitoramento;
- visualizar execuções e incidentes;
- assumir e tratar incidentes;
- solicitar análise de IA;
- gerenciar usuários e papéis.

### ANALYST

Pode:

- visualizar automações;
- consultar execuções;
- consultar, assumir e tratar incidentes;
- solicitar análise de IA;
- registrar resolução.

Não pode:

- gerar credenciais de integração;
- alterar configurações administrativas;
- gerenciar usuários.

### Sistema de origem

Representa uma automação, workflow, script ou pipeline capaz de enviar eventos à API.

### Provedor de IA

Serviço externo utilizado para gerar análise estruturada de um incidente.

---

## 3. Fluxos de Negócio

## 3.1 Fluxo 1 - Integrar uma automação

### Objetivo

Permitir que um administrador cadastre uma automação, gere sua credencial, teste o envio de eventos e ative o monitoramento.

### Fluxo principal

1. O usuário autenticado com papel `ADMIN` acessa a área de Automações.
2. Seleciona **Nova automação**.
3. Informa nome, descrição, origem, criticidade, responsável padrão e duração esperada.
4. O sistema valida os dados e cria a automação com status `DRAFT`.
5. O administrador solicita uma credencial de integração.
6. O sistema gera uma chave, exibe o segredo somente uma vez e armazena apenas seu hash.
7. O sistema apresenta endpoint e exemplo de payload.
8. O administrador realiza um envio de teste.
9. A API valida autenticação, esquema e associação com a automação.
10. O teste é registrado como execução de teste.
11. Se o teste for válido, o sistema permite ativar o monitoramento.
12. A automação passa para `ACTIVE`.
13. O usuário recebe confirmação e visualiza a automação na lista.

### Exceções

- dados obrigatórios ausentes: retorna erro de validação;
- credencial inválida: retorna `401`;
- usuário sem papel administrativo: retorna `403`;
- payload de teste inválido: a integração não pode ser ativada;
- automação desativada: novos eventos produtivos são rejeitados.

### Resultado esperado

A automação termina cadastrada, testada e ativa, pronta para enviar eventos reais sem depender de configuração manual adicional dentro do FlowPulse.

---

## 3.2 Fluxo 2 - Tratar um incidente

### Objetivo

Permitir que uma execução com problema seja recebida, transformada em incidente, investigada e encerrada.

### Fluxo principal

1. Uma automação ativa envia uma execução para `POST /api/v1/executions`.
2. A API autentica a integração e valida o payload.
3. A execução é persistida.
4. O mecanismo de regras avalia o evento.
5. Caso o evento represente `failed`, `timeout` ou duração acima do limite, o sistema cria ou atualiza um incidente.
6. O incidente recebe severidade inicial.
7. O incidente aparece na fila de incidentes.
8. Um analista abre o incidente e seleciona **Assumir**.
9. O status passa para `ACKNOWLEDGED`.
10. O analista pode iniciar a investigação, alterando para `INVESTIGATING`.
11. O analista solicita **Analisar com IA**.
12. Antes da chamada ao provedor, o sistema aplica sanitização nos campos enviados.
13. O provedor de IA retorna uma resposta estruturada.
14. O sistema valida e persiste a análise.
15. O analista utiliza ou descarta as sugestões conforme seu julgamento.
16. O analista registra a descrição da resolução.
17. O status passa para `RESOLVED`.
18. O sistema registra o horário de resolução e atualiza MTTA/MTTR.
19. O histórico permanece disponível para consulta.

### Exceções

- evento inválido: não é persistido como execução válida e retorna erro;
- incidente já aberto para a mesma assinatura de erro: o evento pode ser associado ao incidente existente;
- provedor de IA indisponível: o incidente continua funcional e a interface informa que a análise não pôde ser gerada;
- resposta de IA fora do esquema: a resposta é descartada e registrada como falha técnica;
- usuário sem permissão: a alteração é rejeitada.

### Resultado esperado

O incidente possui começo, acompanhamento e encerramento dentro do FlowPulse, com rastreabilidade de todas as etapas relevantes.

---

## 4. Regras de Negócio

### RN-01 Estados da automação

Uma automação poderá possuir:

- `DRAFT`
- `ACTIVE`
- `INACTIVE`

Somente automações `ACTIVE` aceitam eventos produtivos.

### RN-02 Estados da execução

Uma execução poderá possuir:

- `STARTED`
- `SUCCESS`
- `FAILED`
- `TIMEOUT`

### RN-03 Criação de incidente

Um incidente será avaliado quando:

- a execução estiver em `FAILED`;
- a execução estiver em `TIMEOUT`;
- a duração informada superar o limite definido na automação.

Uma execução `SUCCESS` não gera incidente por padrão.

### RN-04 Severidade inicial

A severidade será definida pela combinação entre criticidade da automação e tipo do evento:

| Criticidade da automação | Falha/timeout | Duração acima do limite |
|---|---|---|
| Alta | CRITICAL | HIGH |
| Média | HIGH | MEDIUM |
| Baixa | MEDIUM | LOW |

A regra poderá ser refinada em versões futuras.

### RN-05 Ciclo do incidente

Transições permitidas:

```text
OPEN -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED
OPEN -> INVESTIGATING
ACKNOWLEDGED -> RESOLVED
RESOLVED -> OPEN  (reabertura)
```

Toda mudança deve gerar evento de histórico.

### RN-06 Responsável

Ao selecionar **Assumir**, o usuário autenticado passa a ser o responsável.

Um `ADMIN` poderá atribuir outro usuário.

### RN-07 Duplicidade

Eventos com a mesma automação e mesma assinatura de erro dentro de uma janela configurável poderão ser agrupados no mesmo incidente aberto.

A assinatura inicial poderá ser formada por:

```text
automation_id + normalized_error_type + normalized_error_message
```

### RN-08 Resolução

Para concluir um incidente é obrigatório registrar uma descrição de resolução.

### RN-09 IA consultiva

A IA:

- não pode alterar status;
- não pode executar comandos;
- não pode chamar o sistema monitorado;
- não pode marcar um incidente como resolvido;
- deve exibir que o conteúdo é uma sugestão;
- deve ter sua saída validada antes da persistência.

---

## 5. Modelo de Dados

### users

- `id` UUID PK
- `external_identity_id` VARCHAR UNIQUE
- `name` VARCHAR
- `email` VARCHAR UNIQUE
- `created_at` TIMESTAMP

### memberships

- `id` UUID PK
- `user_id` UUID FK
- `role` ENUM(`ADMIN`, `ANALYST`)
- `created_at` TIMESTAMP

### automations

- `id` UUID PK
- `name` VARCHAR
- `description` TEXT
- `source_type` VARCHAR
- `criticality` ENUM(`LOW`, `MEDIUM`, `HIGH`)
- `expected_duration_seconds` INTEGER
- `default_owner_id` UUID NULL FK
- `status` ENUM(`DRAFT`, `ACTIVE`, `INACTIVE`)
- `created_by` UUID FK
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

### api_keys

- `id` UUID PK
- `automation_id` UUID FK
- `key_prefix` VARCHAR
- `key_hash` VARCHAR
- `status` ENUM(`ACTIVE`, `REVOKED`)
- `created_at` TIMESTAMP
- `revoked_at` TIMESTAMP NULL

### executions

- `id` UUID PK
- `automation_id` UUID FK
- `external_execution_id` VARCHAR NULL
- `status` ENUM
- `started_at` TIMESTAMP
- `finished_at` TIMESTAMP NULL
- `duration_seconds` INTEGER NULL
- `error_type` VARCHAR NULL
- `error_message` TEXT NULL
- `metadata` JSONB
- `is_test` BOOLEAN DEFAULT FALSE
- `received_at` TIMESTAMP

### incidents

- `id` UUID PK
- `automation_id` UUID FK
- `primary_execution_id` UUID FK
- `title` VARCHAR
- `severity` ENUM(`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `status` ENUM(`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`)
- `owner_id` UUID NULL FK
- `error_fingerprint` VARCHAR
- `acknowledged_at` TIMESTAMP NULL
- `resolved_at` TIMESTAMP NULL
- `resolution_notes` TEXT NULL
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

### incident_events

- `id` UUID PK
- `incident_id` UUID FK
- `actor_user_id` UUID NULL FK
- `event_type` VARCHAR
- `payload` JSONB
- `created_at` TIMESTAMP

### ai_analyses

- `id` UUID PK
- `incident_id` UUID FK
- `requested_by` UUID FK
- `provider` VARCHAR
- `model` VARCHAR
- `summary` TEXT
- `likely_causes` JSONB
- `evidence` JSONB
- `next_steps` JSONB
- `confidence` DECIMAL
- `created_at` TIMESTAMP

### audit_logs

- `id` UUID PK
- `actor_user_id` UUID NULL
- `action` VARCHAR
- `resource_type` VARCHAR
- `resource_id` UUID NULL
- `request_id` VARCHAR
- `details` JSONB
- `created_at` TIMESTAMP

---

## 6. Contratos de API

Base:

```text
/api/v1
```

Formato:

```text
application/json
```

### POST /automations

Cria uma automação.

Requer: `ADMIN`.

### POST /automations/{id}/api-keys

Gera credencial de integração.

Requer: `ADMIN`.

O segredo é devolvido somente na criação.

### POST /automations/{id}/activate

Ativa uma automação após teste válido.

Requer: `ADMIN`.

### GET /automations

Lista automações.

### POST /executions

Recebe um evento de execução.

Autenticação: credencial da automação.

Exemplo:

```json
{
  "external_execution_id": "exec-98321",
  "status": "failed",
  "started_at": "2026-09-20T10:30:00Z",
  "finished_at": "2026-09-20T10:32:15Z",
  "duration_seconds": 135,
  "error_type": "DatabaseTimeout",
  "error_message": "Connection timeout after 30 seconds",
  "metadata": {
    "environment": "production"
  }
}
```

Resposta válida:

```json
{
  "execution_id": "uuid",
  "accepted": true,
  "incident_id": "uuid"
}
```

### GET /executions

Lista execuções com filtros.

### GET /incidents

Lista incidentes com filtros por status, severidade, automação, responsável e período.

### GET /incidents/{id}

Retorna detalhe e histórico.

### POST /incidents/{id}/acknowledge

Assume/reconhece o incidente.

### POST /incidents/{id}/start-investigation

Coloca o incidente em investigação.

### POST /incidents/{id}/ai-analysis

Solicita análise de IA.

Resposta esperada:

```json
{
  "summary": "A execução falhou ao abrir conexão com o banco.",
  "likely_causes": [
    "Banco indisponível",
    "Limite de conexões atingido"
  ],
  "evidence": [
    "Mensagem contém Connection timeout"
  ],
  "next_steps": [
    "Verificar disponibilidade do banco",
    "Consultar uso do pool de conexões"
  ],
  "confidence": 0.78
}
```

### POST /incidents/{id}/resolve

Payload:

```json
{
  "resolution_notes": "Pool de conexões reiniciado e limite revisado."
}
```

### GET /dashboard/summary

Retorna indicadores consolidados.

---

## 7. Tratamento de Erros

Formato baseado em Problem Details:

```json
{
  "type": "https://flowpulse.app/errors/validation",
  "title": "Dados inválidos",
  "status": 422,
  "detail": "O campo status possui valor inválido.",
  "instance": "/api/v1/executions",
  "request_id": "req_123"
}
```

Códigos principais:

- `400` requisição inválida;
- `401` autenticação ausente ou inválida;
- `403` sem permissão;
- `404` recurso inexistente;
- `409` conflito de estado;
- `422` erro de validação;
- `429` limite excedido;
- `500` erro interno;
- `503` dependência externa indisponível.

---

## 8. Segurança e Privacidade

- autenticação de usuários por provedor externo;
- RBAC aplicado no backend;
- chaves de integração armazenadas somente como hash;
- TLS em todos os ambientes remotos;
- segredos somente em variáveis de ambiente/secret manager;
- sanitização antes de enviar conteúdo ao modelo de IA;
- payloads devem limitar dados ao necessário;
- logs da aplicação não devem registrar credenciais ou tokens;
- operações administrativas devem gerar auditoria.

---

## 9. Observabilidade

Cada requisição deverá possuir:

- `request_id`;
- `trace_id` quando houver tracing;
- timestamp;
- serviço;
- rota;
- status;
- duração.

Eventos relevantes:

- execução recebida;
- execução rejeitada;
- incidente criado;
- incidente atualizado;
- análise de IA solicitada;
- análise de IA concluída/falha;
- incidente resolvido.

---

## 10. Critérios de Aceite Técnicos

### Fluxo 1

- criar automação;
- gerar credencial;
- enviar teste;
- ativar monitoramento;
- receber confirmação em todas as etapas;
- executar o fluxo sem alteração manual no banco.

### Fluxo 2

- enviar execução com falha;
- criar incidente automaticamente;
- assumir o incidente;
- iniciar investigação;
- gerar análise utilizando IA real;
- registrar resolução;
- consultar histórico completo;
- executar o fluxo sem telas desconectadas ou dados simulados.

### IA

- chamada real ao provedor;
- resposta estruturada e validada;
- erro do provedor tratado sem interromper o incidente;
- análise persistida e visível;
- testes com resposta válida, inválida e indisponibilidade.

---

## 11. Fora do MVP

- remediação automática;
- execução de comandos pelo LLM;
- múltiplos tenants comerciais;
- billing;
- app mobile nativo;
- conectores nativos extensos;
- observabilidade de infraestrutura em substituição a ferramentas especializadas.
