# ai-assisted-analysis Specification

## Purpose

Define a arquitetura de integração real com a API do OpenRouter, os requisitos de structured output, a sanitização determinística prévia de dados sensíveis, o modelo relacional de persistência (`AiAnalysis`), as regras de governança e a resiliência operacional para a análise assistida de causa-raiz consultiva do FlowPulse.

## Requirements

### Requirement: Modelo relacional da entidade AiAnalysis
O schema Prisma (`apps/api/prisma/schema.prisma`) SHALL declarar a entidade `AiAnalysis` permitindo múltiplas análises consultivas por incidente:

```prisma
model AiAnalysis {
  id                  String       @id @default(uuid())
  incident_id         String
  requested_by_id     String
  model               String
  summary             String       @db.Text
  likely_causes       Json
  evidence            Json
  next_steps          Json
  confidence          Decimal      @db.Decimal(3, 2)
  provider_request_id String?
  latency_ms          Int?
  created_at          DateTime     @default(now())

  incident            Incident     @relation(fields: [incident_id], references: [id], onDelete: Cascade)
  requested_by        User         @relation(fields: [requested_by_id], references: [id], onDelete: Cascade)

  @@index([incident_id, created_at])
  @@map("ai_analyses")
}
```

A migration incremental SHALL ser aplicada versionada via `prisma migrate dev`.

#### Scenario: Persistência de análise estruturada de IA
- **WHEN** uma resposta válida de diagnóstico é recebida do OpenRouter
- **THEN** uma nova linha na tabela `ai_analyses` é criada vinculada ao incidente e ao usuário solicitante, contendo os campos estruturados em formato Json e a confiança numérica

### Requirement: Integração real server-side com OpenRouter API
O backend NestJS SHALL implementar `OpenRouterService` dedicado para comunicação HTTP direta com a API do OpenRouter:
1. Endpoint externo: `POST https://openrouter.ai/api/v1/chat/completions` (ou `${OPENROUTER_BASE_URL}/chat/completions`);
2. Autenticação estritamente server-side via cabeçalho `Authorization: Bearer ${OPENROUTER_API_KEY}`;
3. Cabeçalhos de rastreamento: `HTTP-Referer: ${OPENROUTER_APP_URL}` e `X-Title: ${OPENROUTER_APP_NAME}`;
4. Modelo padrão: `anthropic/claude-haiku-4.5`, configurável via variável de ambiente `OPENROUTER_MODEL`;
5. Timeout de conexão e leitura gerenciado por `AbortController` com limite padrão de 15.000 ms (`OPENROUTER_TIMEOUT_MS`);
6. A chave `OPENROUTER_API_KEY` NUNCA SHALL ser exposta no frontend (proibido prefixo `NEXT_PUBLIC_`), em respostas de API ou em logs estruturados.

#### Scenario: Chamada HTTP externa bem-sucedida ao OpenRouter
- **GIVEN** uma chave de API válida configurada no ambiente
- **WHEN** o serviço invoca o endpoint de chat completions com o payload preparado
- **THEN** a requisição é autenticada e a resposta do modelo é recebida dentro do tempo limite de 15 segundos

### Requirement: Structured output estrito com JSON Schema e validação no backend
A chamada ao OpenRouter SHALL utilizar structured output garantido via parâmetro `response_format` configurado com JSON Schema estrito e diretiva de provider `require_parameters: true`:
1. Schema lógico obrigatório:
   - `summary`: string concisa com o resumo diagnóstico da falha;
   - `likely_causes`: array de objetos contendo `cause` (string) e `rationale` (string com justificativa);
   - `evidence`: array de strings contendo evidências extraídas estritamente dos dados enviados;
   - `next_steps`: array de strings com recomendações diagnósticas ou ações corretivas para o humano;
   - `confidence`: número de ponto flutuante entre 0.0 e 1.0 representando o grau de certeza.
2. O prompt de sistema versionado (ex: `incident-analysis-v1`) SHALL instruir explicitamente o modelo a:
   - Atuar como assistente de diagnóstico operacional;
   - Basear-se exclusivamente nas evidências contidas no contexto fornecido;
   - Tratar causas como hipóteses e nunca como certezas sem comprovação;
   - NUNCA executar nem simular execução de comandos ou mutação de estados;
   - Não incluir raciocínio oculto (sem chain-of-thought privado).
3. O backend SHALL validar defensivamente a resposta recebida contra o schema antes de qualquer inserção no banco. Se o schema for violado, a resposta for vazia ou o JSON for malformado, o backend SHALL rejeitar a análise e emitir erro HTTP `503 Service Unavailable` RFC 7807.

#### Scenario: Validação defensiva com payload em conformidade
- **WHEN** o OpenRouter retorna JSON válido aderente a todas as propriedades obrigatórias do schema
- **THEN** o backend valida a estrutura, persiste o registro em `ai_analyses` e retorna `201 Created`

#### Scenario: Rejeição de resposta do modelo fora do schema
- **WHEN** o OpenRouter responde com JSON ausente de `likely_causes` ou `confidence` fora do intervalo 0–1
- **THEN** o validador interno rejeita os dados, nenhuma linha é gravada em `ai_analyses` e um erro `503` RFC 7807 é retornado ao solicitante

### Requirement: Sanitização determinística pré-envio de dados à IA
O backend SHALL executar rotina determinística de sanitização (`SanitizerService`) sobre todas as informações de texto livre e mensagens de erro (`error_message`) ANTES da construção da mensagem a ser enviada ao OpenRouter:
1. Padrões identificados e redigidos por `[REDACTED]`:
   - Tokens de autenticação `Bearer <token>`;
   - Tokens no formato JWT (`ey...`);
   - Chaves de integração do FlowPulse (`fp_live_<hex>`);
   - Chaves e segredos genéricos (`sk_<chave>`, `pk_<chave>`);
   - Atribuições de credenciais (`password=...`, `secret=...`, `token=...`);
   - Endereços de email (`nome@dominio.com`);
   - Parâmetros sensíveis em query strings.
2. Contexto permitido para envio ao modelo:
   - Automação: `name`, `criticality`, `expected_duration_seconds`;
   - Incidente: `severity`, `opened_at`, `status`;
   - Execução causadora: `status`, `started_at`, `finished_at`, `duration_ms`, `error_message` SANITIZADA;
   - Resumo determinístico opcional de histórico recente da mesma automação.
3. É terminantemente proibido enviar à IA: segredos, hashes de API key, JWTs, headers HTTP completos, segredos do Clerk, identificadores de usuário ou variáveis de ambiente.

#### Scenario: Mensagem de erro contendo credenciais e tokens é sanitizada antes do envio
- **GIVEN** uma execução com `error_message: "Connection failed with Bearer eyJhbGciOi... and password=supersecret"`
- **WHEN** o contexto para IA é gerado
- **THEN** o texto enviado ao modelo contém `"Connection failed with [REDACTED] and [REDACTED]"` comprovando o expurgo de credenciais

### Requirement: Invocação controlada da análise e governança de acesso
O backend SHALL expor os seguintes endpoints sob `/api/v1/incidents/:id/ai-analysis` e `/api/v1/incidents/:id/ai-analyses`:
1. `POST /api/v1/incidents/:id/ai-analysis`:
   - Pré-condição de status: o incidente DEVE estar em status `INVESTIGATING`. Se estiver em `OPEN`, `ACKNOWLEDGED` ou `RESOLVED`, a requisição SHALL ser rejeitada com HTTP `409 Conflict` (RFC 7807);
   - Governança de acesso: se o usuário for `ANALYST`, o incidente DEVE estar atribuído a ele (`assigned_to_id === request.user.id`). Se pertencer a outro analista, retorna HTTP `403 Forbidden` (RFC 7807); se o usuário for `ADMIN`, a execução é permitida;
   - Caráter consultivo estrito: a conclusão da análise de IA NUNCA altera o `status` do incidente, não marca resolução e não executa mutações no sistema monitorado. O incidente permanece inalterado em `INVESTIGATING`;
   - Múltiplas análises: o endpoint pode ser invocado mais de uma vez no mesmo incidente caso o analista necessite de novas rodadas diagnósticas;
2. `GET /api/v1/incidents/:id/ai-analyses`:
   - Lista todas as análises de IA já persistidas para o incidente, ordenadas por `created_at DESC`. Acesso concedido a `ADMIN` e `ANALYST`.

#### Scenario: Analista responsável solicita análise em incidente em investigação
- **GIVEN** um incidente em status `INVESTIGATING` atribuído ao analista autenticado
- **WHEN** o analista invoca `POST /api/v1/incidents/:id/ai-analysis`
- **THEN** a análise é executada, persistida em `ai_analyses`, um evento `AI_ANALYSIS_COMPLETED` é registrado e o incidente permanece em status `INVESTIGATING`

#### Scenario: Solicitação de análise em incidente com status OPEN é rejeitada
- **GIVEN** um incidente em status `OPEN`
- **WHEN** qualquer usuário invoca `POST /api/v1/incidents/:id/ai-analysis`
- **THEN** a requisição é rejeitada com HTTP `409 Conflict` RFC 7807 e nenhuma chamada externa é disparada

### Requirement: Resiliência operacional, timeout e não-bloqueio de falhas
O fluxo de análise assistida por IA SHALL ser totalmente desacoplado da integridade operacional do incidente:
1. A chamada HTTP externa ao OpenRouter SHALL ser executada fora de transações de banco de dados;
2. Em caso de falha de conexão, timeout (excedendo 15s), erro de autenticação do provedor (401/403), limite de taxa (429) ou indisponibilidade (5xx):
   - A API SHALL registrar a falha em log estruturado interno (sem vazar credenciais);
   - A API SHALL responder imediatamente com HTTP `503 Service Unavailable` Problem Details RFC 7807 informando indisponibilidade transitória do serviço de inteligência;
   - O status do incidente SHALL permanecer inalterado em `INVESTIGATING`;
   - O fluxo manual de resolução do analista NUNCA SHALL ser bloqueado pela falha da IA;
   - O backend NUNCA SHALL gerar respostas simuladas ("fake fallback").

#### Scenario: Provedor OpenRouter indisponível não impede investigação manual
- **GIVEN** um incidente em status `INVESTIGATING` e o provedor OpenRouter retornando HTTP 503 ou sofrendo timeout
- **WHEN** o analista solicita análise assistida
- **THEN** a requisição retorna HTTP `503 Service Unavailable` RFC 7807, o incidente permanece em `INVESTIGATING` e o analista pode proceder normalmente para a resolução manual do incidente
