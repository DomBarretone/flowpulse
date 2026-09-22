# Proposal: 04-incident-lifecycle-ai

## Objetivo

Implementar o **Fluxo 2** completo (sem dashboard): ciclo de vida completo do incidente desde `OPEN` até `RESOLVED`, integração real com OpenRouter para análise assistida de causa-raiz, persistência de `ai_analyses` e trilha de eventos em `incident_events`.

Este change parte de um incidente `OPEN` já existente (criado pelo change 03) e entrega todos os endpoints de transição de estado, a análise de IA e o registro de resolução com `resolution_notes` obrigatórias.

---

## Escopo

### Incluído

**Backend (apps/api) — IncidentsModule (ciclo de vida completo)**
- Extensão do schema Prisma de `Incident`: adição dos campos `owner_id`, `acknowledged_at`, `resolved_at`, `resolution_notes`
- Migration versionada com os campos adicionais
- Transições de estado permitidas (RN-05):
  - `OPEN → ACKNOWLEDGED`
  - `OPEN → INVESTIGATING`
  - `ACKNOWLEDGED → INVESTIGATING`
  - `ACKNOWLEDGED → RESOLVED`
  - `INVESTIGATING → RESOLVED`
  - `RESOLVED → OPEN` (reabertura)
- Qualquer transição inválida retorna `409 Conflict` com detalhe da transição ilegal
- Toda transição gera evento em `incident_events` com `actor_user_id`, `event_type` e `payload` relevante

**Endpoints de ciclo de vida:**
- `GET /api/v1/incidents` — lista incidentes com filtros: `status`, `severity`, `automation_id`, `owner_id`, período (ADMIN, ANALYST)
- `GET /api/v1/incidents/{id}` — detalhe completo: dados do incidente, execução primária, `incident_events` e `ai_analyses` já realizadas
- `POST /api/v1/incidents/{id}/acknowledge` — atribui usuário autenticado como `owner_id`, transita para `ACKNOWLEDGED`, preenche `acknowledged_at` (ADMIN, ANALYST)
- `POST /api/v1/incidents/{id}/start-investigation` — transita para `INVESTIGATING` (ADMIN, ANALYST)
- `POST /api/v1/incidents/{id}/resolve` — valida `resolution_notes` obrigatórias, transita para `RESOLVED`, preenche `resolved_at` (ADMIN, ANALYST); retorna 422 se `resolution_notes` ausente ou vazio
- Registro em `audit_logs` a cada transição de estado e resolução

**Backend (apps/api) — AiModule (OpenRouter real)**
- Entidade `AiAnalysis` com schema Prisma: `id`, `incident_id`, `requested_by`, `provider`, `model`, `summary`, `likely_causes` (JSON), `evidence` (JSON), `next_steps` (JSON), `confidence` (Decimal), `created_at`
- Migration versionada para `ai_analyses`
- `POST /api/v1/incidents/{id}/ai-analysis`:
  1. Sanitização obrigatória do payload: remoção de senhas, tokens e PII antes do envio ao OpenRouter
  2. Chamada HTTP autenticada à API do OpenRouter com prompt estruturado
  3. Validação rigorosa do schema de retorno: `summary` (string), `likely_causes` (array), `evidence` (array), `next_steps` (array), `confidence` (number 0–1)
  4. Se a resposta for inválida: registra anomalia em log, retorna 503 sem persistir dados corrompidos
  5. Se o OpenRouter retornar erro ou timeout: retorna 503 controlado, registra falha em log, **nunca bloqueia** o fluxo manual de investigação
  6. Persiste resultado validado em `ai_analyses` via Prisma
  7. Gera evento `AI_ANALYSIS_REQUESTED` em `incident_events`
  8. Retorna a análise ao frontend
- **Invariante crítica:** a IA nunca altera o `status` do incidente nem executa remediações automáticas

**Frontend (apps/web)**
- Página `/incidents` — fila de incidentes com filtros por status, severidade e responsável
- Página `/incidents/{id}` — detalhe completo com:
  - Card de informações do incidente (status, severidade, responsável, timestamps)
  - Timeline de eventos (`incident_events`)
  - Botões de ação contextuais: Assumir, Iniciar investigação, Analisar com IA, Resolver
  - Card de análise de IA com aviso visual explícito de caráter consultivo (texto + ícone, não apenas cor — WCAG 2.1 AA)
  - Modal de resolução com campo obrigatório `resolution_notes`

### Excluído

- Dashboard e métricas MTTA/MTTR — change 05
- Cálculo de MTTA e MTTR (os timestamps `acknowledged_at` e `resolved_at` são gravados aqui; os cálculos agregados são implementados no change 05)
- OpenTelemetry completo — change 06
- Testes E2E Playwright do Fluxo 2 — change 06 (testes unitários e de integração estão incluídos aqui)

---

## Entidades e Migrations

| Entidade | Tabela | Neste change |
|----------|--------|--------------|
| Incident | `incidents` | ✅ Extensão (owner_id, acknowledged_at, resolved_at, resolution_notes) + migration |
| IncidentEvent | `incident_events` | ✅ Já existe (change 03). Novos event_types adicionados. |
| AiAnalysis | `ai_analyses` | ✅ Schema + migration |
| AuditLog | `audit_logs` | ✅ Já existe (change 03). Novos registros de transições. |

---

## Contratos de API

| Método | Rota | Auth | Papel | Descrição |
|--------|------|------|-------|-----------|
| `GET` | `/api/v1/incidents` | Clerk JWT | ADMIN, ANALYST | Lista incidentes com filtros |
| `GET` | `/api/v1/incidents/{id}` | Clerk JWT | ADMIN, ANALYST | Detalhe completo |
| `POST` | `/api/v1/incidents/{id}/acknowledge` | Clerk JWT | ADMIN, ANALYST | Assume o incidente |
| `POST` | `/api/v1/incidents/{id}/start-investigation` | Clerk JWT | ADMIN, ANALYST | Inicia investigação |
| `POST` | `/api/v1/incidents/{id}/ai-analysis` | Clerk JWT | ADMIN, ANALYST | Solicita análise de IA |
| `POST` | `/api/v1/incidents/{id}/resolve` | Clerk JWT | ADMIN, ANALYST | Registra resolução |

---

## Critério de Conclusão

```bash
npm run test          # testes unitários e de integração deste change passando
npm run typecheck     # sem erros
npm run lint          # sem erros
npm run build         # sem erros
```

**Testes unitários:**
- Motor de transição RN-05: todas as transições permitidas são aceitas; todas as transições inválidas são rejeitadas com 409
- `IncidentsService.resolve()`: ausência de `resolution_notes` lança exceção 422
- Sanitização de payload para OpenRouter: credenciais e tokens são removidos do objeto antes do envio
- `AiService`: resposta inválida do OpenRouter (schema incorreto) → registra anomalia, não persiste, retorna 503
- `AiService`: timeout/erro do OpenRouter → retorna 503, incidente permanece operacional
- Invariante: `AiService` nunca chama `IncidentsService.updateStatus()`

**Testes de integração (Supertest):**
- `POST /incidents/{id}/acknowledge` → 200, status ACKNOWLEDGED, `acknowledged_at` preenchido, evento criado
- `POST /incidents/{id}/resolve` sem `resolution_notes` → 422 RFC 7807
- `POST /incidents/{id}/resolve` com `resolution_notes` → 200, status RESOLVED, `resolved_at` preenchido, audit_log criado
- `POST /incidents/{id}/ai-analysis` com mock OpenRouter retornando schema válido → 201, `ai_analyses` persistida
- `POST /incidents/{id}/ai-analysis` com mock OpenRouter retornando 503 → endpoint retorna 503, incidente status inalterado

---

## Não-objetivos

- Cálculo agregado de MTTA/MTTR (change 05)
- Dashboard de indicadores (change 05)
- Testes E2E do Fluxo 2 (change 06)
- Remediação automática ou autônoma pela IA

---

## Dependências

- `03-automation-integration` (incidentes OPEN existentes, schema `incidents`, `incident_events`, `audit_logs`)

---

## Referências

- `@docs/spec.md` — Seções 3.2 (Fluxo 2), 4 (Regras RN-05 a RN-09), 6 (Contratos de API)
- `@docs/architecture.md` — Visão de Componentes, Segurança (Sanitização de IA)
- `@AGENTS.md` — Seção 5 (IA consultiva), regras de resolução obrigatória com resolution_notes
