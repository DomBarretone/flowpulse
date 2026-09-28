# incident-events Specification

## Purpose

Define a estrutura de dados, contratos de emissão e requisitos de imutabilidade e segurança para a trilha de eventos (`IncidentEvent`) do FlowPulse, assegurando a rastreabilidade cronológica de todas as ações de ciclo de vida e diagnósticos assistidos por IA sobre incidentes operacionais.

## Requirements

### Requirement: Modelo relacional da entidade IncidentEvent
O schema Prisma (`apps/api/prisma/schema.prisma`) SHALL conter o modelo `IncidentEvent` e o enum `IncidentEventType` com a seguinte definição:

```prisma
enum IncidentEventType {
  ACKNOWLEDGED
  INVESTIGATION_STARTED
  AI_ANALYSIS_REQUESTED
  AI_ANALYSIS_COMPLETED
  RESOLVED
}

model IncidentEvent {
  id            String             @id @default(uuid())
  incident_id   String
  actor_user_id String?
  event_type    IncidentEventType
  from_status   IncidentStatus?
  to_status     IncidentStatus?
  note          String?            @db.Text
  created_at    DateTime           @default(now())

  incident      Incident           @relation(fields: [incident_id], references: [id], onDelete: Cascade)
  actor         User?              @relation(fields: [actor_user_id], references: [id], onDelete: SetNull)

  @@index([incident_id, created_at])
  @@map("incident_events")
}
```

A migration incremental SHALL ser aplicada versionada via `prisma migrate dev`.

#### Scenario: Criação da tabela de eventos no banco
- **WHEN** a migration do Prisma é executada
- **THEN** a tabela `incident_events` é criada com índices em `(incident_id, created_at)` e restrições de integridade referencial com `incidents` e `users`

---

### Requirement: Emissão atômica de eventos em transições e análises
O backend SHALL garantir que toda alteração de estado no ciclo de vida do incidente registre um evento correspondente na tabela `incident_events` dentro do mesmo bloco transacional da alteração:
1. Na transição `OPEN → ACKNOWLEDGED`: emitir evento com `event_type: ACKNOWLEDGED`, `from_status: OPEN`, `to_status: ACKNOWLEDGED` e `actor_user_id` preenchido com o usuário autenticado;
2. Na transição `ACKNOWLEDGED → INVESTIGATING`: emitir evento com `event_type: INVESTIGATION_STARTED`, `from_status: ACKNOWLEDGED`, `to_status: INVESTIGATING` e `actor_user_id` preenchido;
3. Na conclusão com sucesso da análise de IA: emitir evento com `event_type: AI_ANALYSIS_COMPLETED`, vinculando a análise persistida e o solicitante;
4. Na transição `INVESTIGATING → RESOLVED`: emitir evento com `event_type: RESOLVED`, `from_status: INVESTIGATING`, `to_status: RESOLVED`, `actor_user_id` e o resumo das notas explicativas em `note`.

Caso a gravação do evento falhe, a transação inteira SHALL ser revertida (rollback), impedindo estados de transição sem registro na trilha.

#### Scenario: Transição de estado grava evento com sucesso na mesma transação
- **GIVEN** uma transição válida de `OPEN` para `ACKNOWLEDGED`
- **WHEN** a mutação é executada no banco
- **THEN** o status do incidente é alterado e uma nova linha em `incident_events` é persistida atomicamente com os status de origem e destino corretos

---

### Requirement: Consulta cronológica da trilha de eventos
O backend SHALL disponibilizar o endpoint `GET /api/v1/incidents/:id/events`, protegido por `ClerkAuthGuard` e `RolesGuard` (`ADMIN` e `ANALYST`), retornando a lista de eventos vinculados ao incidente:
- A ordenação SHALL ser estritamente cronológica ascendente (`created_at ASC`);
- Cada item da resposta SHALL incluir: `id`, `event_type`, `from_status`, `to_status`, `note`, `created_at` e os dados seguros do ator (`id`, `name`, `email`);
- Se o incidente não existir, a API SHALL retornar HTTP `404 Not Found` Problem Details RFC 7807 contendo `request_id`.

#### Scenario: Analista consulta linha do tempo do incidente
- **GIVEN** um incidente que passou por assunção e início de investigação
- **WHEN** um usuário autenticado envia `GET /api/v1/incidents/:id/events`
- **THEN** a API retorna status `200 OK` com a lista ordenada contendo os eventos `ACKNOWLEDGED` e `INVESTIGATION_STARTED`

---

### Requirement: Imutabilidade e expurgo de credenciais sensíveis na trilha de eventos
Os registros da tabela `incident_events` SHALL ser estritamente imutáveis:
1. O backend não SHALL prover nenhum endpoint ou método de serviço para atualização (`UPDATE`) ou remoção (`DELETE`) de eventos individuais de histórico;
2. O campo `note` ou qualquer metadado do evento NUNCA SHALL armazenar tokens JWT, cabeçalhos de autorização, chaves `fp_live_*`, segredos `OPENROUTER_API_KEY` ou mensagens de erro não sanitizadas;
3. Toda informação textual associada a falhas registradas em eventos SHALL passar previamente pelo serviço de sanitização.

#### Scenario: Validação de ausência de segredos na nota do evento
- **WHEN** um evento é persistido no histórico
- **THEN** nenhum token Bearer, API key ou dado sigiloso está contido nos campos textuais do registro
