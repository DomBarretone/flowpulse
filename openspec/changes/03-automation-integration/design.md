# Design: 03-automation-integration

## 1. Contexto e Visão Geral

A change `03-automation-integration` constrói o primeiro fluxo de negócio completo ponta a ponta do FlowPulse (**Fluxo 1: Integração e Monitoramento de Automações**) e estabelece a fronteira do modelo de dados para o **Fluxo 2 (Tratamento de Incidentes)**.

Partindo da fundação de identidade estabelecida na change `02-auth-rbac` (onde usuários humanos são autenticados via Clerk JWT e autorizados por `RolesGuard` como `ADMIN` ou `ANALYST`), este incremento introduz:
1. Um modelo relacional para automações gerenciadas (`Automation`);
2. Um subsistema de credenciais de máquina de alta entropia (`ApiKey`), autenticado por `ApiKeyGuard` com hash criptográfico SHA-256;
3. Um pipeline de ingestão de execuções (`POST /api/v1/executions`) com suporte a testes reais de integração e idempotência rigorosa;
4. Regras de validação pré-ativação de monitoramento;
5. Criação automática de incidentes em status `OPEN` para execuções reais com falha;
6. Uma interface de usuário em Next.js 15 estritamente alinhada a `@docs/design.md` e aos padrões WCAG 2.1 AA.

---

## 2. Metas e Não-Metas (Goals / Non-Goals)

### Metas
- Implementar modelo relacional Prisma com migrations versionadas para `automations`, `api_keys`, `executions` e `incidents` (mínimo).
- Permitir ao `ADMIN` cadastrar automação (`DRAFT`, `PENDING`), editar parâmetros (`criticality`, `expected_duration_seconds`) e gerar credenciais.
- Gerar chaves criptográficas fortes `fp_live_<32_bytes_hex>`, persistir exclusivamente o hash SHA-256 e exibir o segredo puro uma única vez ao usuário.
- Implementar `ApiKeyGuard` em NestJS dedicado à ingestão externa via header `x-api-key`.
- Prover endpoint `POST /api/v1/executions` que valida a chave, infere a automação correspondente e rejeita qualquer tentativa do cliente de injetar `automation_id` arbitrário.
- Garantir que o evento de teste (`is_test: true`) valide a integração (`integration_status: VALIDATED`), sem criar incidentes.
- Bloquear a transição da automação para `ACTIVE` caso seu `integration_status` seja diferente de `VALIDATED`.
- Garantir idempotência na ingestão: requisições com o mesmo `(automation_id, external_execution_id)` não geram execuções duplicadas nem incidentes duplicados.
- Criar automaticamente um `Incident` em status `OPEN` com severidade calculada deterministicamente quando uma execução real (`is_test: false`) falhar (`status: FAILED`) em uma automação `ACTIVE`.
- Entregar interface web completa com listagem, criação, exibição única de segredo com cópia segura, guia cURL de teste, indicador de status e histórico de execuções.
- Garantir zero armazenamento de credenciais de integração em `localStorage`, `sessionStorage`, `cookies` ou logs.

### Não-Metas
- Ciclo de vida posterior do incidente (`ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`) — change 04.
- Atribuição de responsável por incidente e notas de investigação/resolução — change 04.
- Integração com IA (OpenRouter) para análise de causa-raiz — change 04.
- Dashboard analítico consolidado e cálculo de métricas MTTA/MTTR — change 05.
- Coleta de métricas e tracing via OpenTelemetry SDK distribuído — change 06.
- Testes E2E com Playwright em navegadores reais — change 06.
- Docker multi-stage produtivo e IaC Terraform — change 07.

---

## 3. Decisões Arquiteturais

### D-01: Schema Relacional Incremental e Enums

O banco de dados relacional PostgreSQL é manipulado exclusivamente pelo backend NestJS via Prisma ORM com migrações versionadas (`prisma migrate dev`). O frontend nunca acessa o banco diretamente.

#### Enums
- `Criticality`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `AutomationStatus`: `DRAFT`, `ACTIVE`, `INACTIVE`
- `IntegrationStatus`: `PENDING`, `VALIDATED`, `FAILED`
- `ExecutionStatus`: `RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`
- `IncidentStatus`: `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED` (nesta change, apenas `OPEN` é instanciado)
- `IncidentSeverity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

#### Modelos Prisma

```prisma
model Automation {
  id                        String            @id @default(uuid())
  name                      String
  description               String?
  owner_id                  String
  criticality               Criticality       @default(MEDIUM)
  expected_duration_seconds Int
  status                    AutomationStatus  @default(DRAFT)
  integration_status        IntegrationStatus @default(PENDING)
  created_at                DateTime          @default(now())
  updated_at                DateTime          @updatedAt

  owner                     User              @relation(fields: [owner_id], references: [id])
  api_keys                  ApiKey[]
  executions                Execution[]
  incidents                 Incident[]

  @@map("automations")
}

model ApiKey {
  id            String    @id @default(uuid())
  automation_id String
  key_hash      String    @unique
  prefix        String
  created_at    DateTime  @default(now())
  revoked_at    DateTime?
  last_used_at  DateTime?

  automation    Automation @relation(fields: [automation_id], references: [id], onDelete: Cascade)

  @@index([key_hash])
  @@map("api_keys")
}

model Execution {
  id                    String          @id @default(uuid())
  automation_id         String
  external_execution_id String
  status                ExecutionStatus
  started_at            DateTime
  finished_at           DateTime?
  duration_ms           Int?
  error_message         String?
  is_test               Boolean         @default(false)
  created_at            DateTime        @default(now())

  automation            Automation      @relation(fields: [automation_id], references: [id], onDelete: Cascade)
  incident              Incident?

  @@unique([automation_id, external_execution_id])
  @@index([automation_id, created_at])
  @@map("executions")
}

model Incident {
  id            String           @id @default(uuid())
  automation_id String
  execution_id  String           @unique
  status        IncidentStatus   @default(OPEN)
  severity      IncidentSeverity
  opened_at     DateTime         @default(now())
  created_at    DateTime         @default(now())
  updated_at    DateTime         @updatedAt

  automation    Automation       @relation(fields: [automation_id], references: [id], onDelete: Cascade)
  execution     Execution        @relation(fields: [execution_id], references: [id], onDelete: Cascade)

  @@index([automation_id, status])
  @@map("incidents")
}
```

---

### D-02: Geração Criptográfica e Segurança de API Keys

**Geração:**
- Utiliza gerador de números pseudoaleatórios criptograficamente seguro (`crypto.randomBytes(32)`).
- Formato lógico: `fp_live_<64_hex_chars>`.
- Exemplo: `fp_live_e4d909c290d0fb1ca068ffaddf22cbd0ffd829efe1823f802917112ea1bc6432`.
- Total de entropia: 256 bits, imune a ataques de força bruta.

**Persistência e Hash:**
- O segredo completo é passado para a função hash SHA-256 determinística:
  `key_hash = crypto.createHash('sha256').update(rawKey).digest('hex')`
- O banco de dados armazena estritamente `key_hash` e `prefix` (os primeiros 12 caracteres, e.g. `fp_live_e4d9...`).
- A chave pura é retornada na resposta HTTP de criação (`POST /api/v1/automations/:id/api-keys`) uma única vez.
- Endpoints `GET` posteriores listam apenas `id`, `prefix`, `created_at`, `revoked_at` e `last_used_at`.
- É terminantemente proibido registrar a chave pura ou o hash em logs, erros RFC 7807 ou exceções.

---

### D-03: `ApiKeyGuard` e Autenticação de Máquina

- O `ApiKeyGuard` é implementado em `apps/api/src/common/guards/api-key.guard.ts`.
- Não utiliza Clerk nem sessão JWT.
- Procedimento do Guard:
  1. Extrai o valor do cabeçalho `x-api-key`.
  2. Valida o prefixo `fp_live_`. Se ausente ou malformado, lança `UnauthorizedException` com Problem Details RFC 7807.
  3. Calcula o SHA-256 do token recebido.
  4. Executa query indexada em `api_keys` buscando correspondência exata de `key_hash` onde `revoked_at IS NULL`.
  5. Se não encontrado, lança `UnauthorizedException` (401).
  6. Se a automação associada estiver com `status == INACTIVE`, bloqueia execuções produtivas (`is_test: false`) com erro apropriado.
  7. Atualiza `last_used_at` da chave.
  8. Injeta os metadados da automação e da credencial no objeto de requisição (`request.automation` e `request.apiKey`).

---

### D-04: Idempotência de Ingestão e Concorrência

Para impedir duplicidade de execuções e de incidentes gerados por reenvio acidental de webhooks ou falhas de rede:
1. Restrição única no PostgreSQL: `@@unique([automation_id, external_execution_id])`.
2. No handler de `POST /api/v1/executions`:
   - O serviço realiza busca prévia por `(automation_id, external_execution_id)`.
   - Se já existir:
     - O backend retorna a execução existente com HTTP `200 OK` (ou `201 Created` idempotente), contendo `execution_id` e eventual `incident_id` já vinculado.
     - Nenhuma nova linha é inserida em `executions` e nenhum novo `Incident` é criado.
   - Se for inédita:
     - Cria o registro em `executions` dentro de transação Prisma.
     - Se `is_test: true`, atualiza `Automation.integration_status` para `VALIDATED` na mesma transação.
     - Se `is_test: false`, `status: FAILED` e `Automation.status == ACTIVE`, cria o registro `Incident` em `OPEN`.

---

### D-05: Fluxo Real de Validação de Integração

O FlowPulse proíbe validações artificiais ou simulações puramente de frontend.
1. O administrador cadastra a automação (`status: DRAFT`, `integration_status: PENDING`).
2. O administrador gera a credencial e copia o token `fp_live_...`.
3. O administrador (ou pipeline externo) dispara:
   ```bash
   curl -X POST http://localhost:3001/api/v1/executions \
     -H "Content-Type: application/json" \
     -H "x-api-key: fp_live_..." \
     -d '{
       "external_execution_id": "test-run-001",
       "status": "SUCCESS",
       "started_at": "2026-09-27T19:00:00Z",
       "finished_at": "2026-09-27T19:00:02Z",
       "duration_ms": 2000,
       "is_test": true
     }'
   ```
4. A API valida a chave real, grava a execução de teste e altera `integration_status` para `VALIDATED`.
5. O frontend reflete `VALIDATED` e habilita o botão **Ativar Monitoramento**.
6. Somente então o endpoint `POST /api/v1/automations/:id/activate` permite a transição para `status: ACTIVE`.

---

### D-06: Fronteira para o Fluxo 2 — Regra Determinística de Severidade

Quando uma execução real (`is_test: false`) apresentar falha (`status: FAILED`) em uma automação ativa (`status: ACTIVE`), o backend cria automaticamente um `Incident` em status `OPEN`.

A severidade inicial do incidente deriva deterministicamente da criticidade configurada na automação:

| Automation.criticality | Execution.status | Incident.severity |
|---|---|---|
| `CRITICAL` | `FAILED` | `CRITICAL` |
| `HIGH` | `FAILED` | `CRITICAL` |
| `MEDIUM` | `FAILED` | `HIGH` |
| `LOW` | `FAILED` | `MEDIUM` |

*Nota:* Execuções com `status: SUCCESS` ou `RUNNING` não geram incidente. Execuções de teste (`is_test: true`) nunca geram incidente sob nenhuma hipótese.

---

### D-07: Frontend Architecture & Diretrizes de Design

- **App Router e Layout Protegido:**
  - Rotas organizadas sob `apps/web/src/app/(protected)/automations/`.
  - `/automations`: listagem de automações com filtros de status e criticidade.
  - `/automations/new`: formulário de cadastro com validação de campos.
  - `/automations/[id]`: detalhes da automação, chaves de integração, cURL seguro de teste e execuções recentes.
- **Segurança de Segredos:**
  - O segredo `fp_live_...` é mantido apenas no estado local React do componente de modal/alerta que o exibe após a criação.
  - Ao fechar o modal ou navegar para fora da página, a chave é desalocada da memória.
  - Nenhuma persistência em `localStorage`, `sessionStorage` ou `cookies`.
- **Acessibilidade & Design System:**
  - Segue estritamente `@docs/design.md`.
  - Cores semânticas aplicadas com indicador textual e ícone (`Badge` com texto + cor + ícone para `PENDING`, `VALIDATED`, `ACTIVE`, `FAILED`).
  - Contraste visual mínimo de 4.5:1.
  - Controles e botões com foco visível (`focus-visible:ring-2`) e navegação por teclado.
- **RBAC no Frontend:**
  - Usuários `ADMIN` possuem acesso total aos botões de criar automação, gerar credencial, revogar credencial e ativar/desativar monitoramento.
  - Usuários `ANALYST` possuem visão em modo de leitura (botões administrativos ocultos ou desabilitados com mensagem explicativa), com proteção redundante garantida no backend pelos Guards.
