# Especificação Técnica do Produto

## 1. Visão Geral

O FlowPulse é uma aplicação web voltada ao monitoramento centralizado, triagem e tratamento de incidentes para automações e pipelines de dados.

A solução é construída sob uma arquitetura desacoplada:
- **Frontend:** Next.js, TypeScript e Tailwind CSS.
- **Backend:** NestJS e TypeScript, expondo uma API exclusivamente RESTful sob o prefixo `/api/v1`.
- **Persistência:** Prisma ORM com PostgreSQL hospedado no Supabase (com acesso restrito ao backend, sendo vedado o acesso direto do frontend ao banco ou à Supabase Data API).
- **Autenticação e Autorização:** Clerk como serviço externo de identidade e RBAC (`ADMIN` e `ANALYST`) validado no backend.
- **Inteligência Artificial:** Integração real pelo backend com OpenRouter para análise assistida de causa-raiz.

Esta especificação transforma os requisitos do PRD em comportamentos, regras de negócio e contratos técnicos para orientar a implementação.

O sistema suporta e garante a execução ponta a ponta de dois fluxos de negócio centrais:

1. **FLUXO 1 - Integração de uma automação ao monitoramento:** login de ADMIN via Clerk -> cadastro -> definição de criticidade/duração esperada -> geração de credencial -> teste real da integração via API REST -> evento recebido e persistido -> ativação do monitoramento.
2. **FLUXO 2 - Tratamento de incidente:** execução com falha enviada pela automação -> recebimento pela API REST -> persistência -> criação automática do incidente -> analista assume -> investigação -> análise real assistida por IA (OpenRouter) -> registro da resolução -> incidente finalizado em `RESOLVED`.

---

## 2. Atores

### ADMIN

Usuário autenticado via Clerk com perfil `ADMIN`.

Pode:
- cadastrar, editar, ativar e desativar automações;
- gerar e revogar credenciais de integração (API keys);
- visualizar dashboards, execuções e incidentes;
- assumir e tratar incidentes;
- solicitar análise assistida por IA;
- gerenciar usuários e atribuição de papéis.

### ANALYST

Usuário autenticado via Clerk com perfil `ANALYST`.

Pode:
- visualizar automações e métricas;
- consultar histórico de execuções;
- consultar, assumir, investigar e tratar incidentes;
- solicitar análise assistida por IA via OpenRouter;
- registrar notas de resolução e finalizar incidentes.

Não pode:
- gerar ou revogar credenciais de integração;
- alterar configurações globais da automação ou da plataforma;
- gerenciar usuários e permissões.

### Sistema de Origem

Representa qualquer workflow, script (Python, Bash), orquestrador (n8n, AWS Step Functions, Airflow) ou serviço externo capaz de realizar requisições HTTPS e enviar eventos padronizados para a API REST do FlowPulse autenticado por chave de API.

### Provedor de IA (OpenRouter)

Serviço externo de inteligência artificial acionado exclusivamente pelo backend NestJS para produzir análises estruturadas de causa-raiz e diagnóstico para incidentes.

---

## 3. Fluxos de Negócio

## 3.1 Fluxo 1 - Integrar uma automação

### Objetivo

Permitir que um administrador cadastre uma automação, configure parâmetros de criticidade e limite de tempo, gere credencial segura, teste o envio de eventos reais e ative o monitoramento produtivo.

### Fluxo principal

1. O usuário realiza login via Clerk e obtém token JWT com perfil `ADMIN`.
2. Acessa a interface web (Next.js) na rota de Automações e seleciona **Nova automação**.
3. Informa nome, descrição, origem (ex.: n8n, Python, Step Functions), criticidade (`LOW`, `MEDIUM`, `HIGH`), responsável padrão e duração esperada em segundos.
4. O frontend envia a requisição para `POST /api/v1/automations`.
5. O backend NestJS valida a requisição, persiste a entidade no PostgreSQL/Supabase via Prisma com status `DRAFT` e registra log de auditoria.
6. O administrador solicita a emissão de credencial em `POST /api/v1/automations/{id}/api-keys`.
7. O backend gera uma chave de API aleatória com prefixo identificável (`fp_live_...`), armazena no banco exclusivamente o hash criptográfico seguro (SHA-256) e retorna a chave completa uma única vez para exibição.
8. O frontend exibe a chave de integração, o endpoint de ingestão (`POST /api/v1/executions`) e o exemplo de payload.
9. O administrador (ou pipeline externo) dispara uma requisição de teste real contendo o cabeçalho `x-api-key` e payload com flag `is_test: true`.
10. A API REST (`/api/v1/executions`) autentica a chave por comparação de hash, valida os campos e persiste o evento de execução de teste no banco via Prisma.
11. Com a confirmação do teste recebido com sucesso, o frontend habilita a opção de ativação.
12. O administrador aciona **Ativar monitoramento** (`POST /api/v1/automations/{id}/activate`).
13. O backend altera o status da automação para `ACTIVE` e registra evento de auditoria.
14. A automação é exibida como ativa e pronta para receber execuções produtivas.

### Exceções

- dados obrigatórios ausentes: API retorna `422 Unprocessable Entity` com detalhes;
- chave inválida ou revogada: API retorna `401 Unauthorized`;
- usuário sem perfil `ADMIN`: backend rejeita com `403 Forbidden`;
- payload de teste ausente ou corrompido: ativação permanece bloqueada;
- automação com status `INACTIVE` ou `DRAFT`: eventos produtivos são rejeitados com `409 Conflict`.

### Resultado esperado

Automação cadastrada, credenciada, testada com evento real e com monitoramento ativo, apta a receber eventos produtivos sem necessidade de intervenção manual no banco.

---

## 3.2 Fluxo 2 - Tratar um incidente

### Objetivo

Receber uma execução com erro ou estouro de duração, gerar o incidente correspondente, permitir que o analista assuma a ocorrência, conduzir a investigação com apoio de IA real via OpenRouter e registrar a resolução definitiva.

### Fluxo principal

1. Uma automação externa ativa dispara um evento de execução para `POST /api/v1/executions`.
2. O backend NestJS autentica a requisição via cabeçalho `x-api-key`, valida o corpo da requisição e persiste o registro em `executions` via Prisma ORM.
3. O mecanismo de regras de negócio avalia o status (`FAILED`, `TIMEOUT`) ou se a duração informada excedeu o `expected_duration_seconds` configurado na automação.
4. O sistema cria automaticamente um novo registro em `incidents` associado à execução, define o status como `OPEN` e calcula a severidade inicial (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) com base na criticidade e no tipo do evento.
5. Um evento de histórico é inserido em `incident_events`.
6. O incidente passa a ser exibido na fila de incidentes e no dashboard do frontend.
7. Um analista autenticado via Clerk acessa o detalhe do incidente e aciona **Assumir**.
8. O frontend envia `POST /api/v1/incidents/{id}/acknowledge`. O backend atribui o analista como `owner_id`, altera o status para `ACKNOWLEDGED`, calcula o MTTA e registra a ação no histórico.
9. O analista altera o status para `INVESTIGATING` via `POST /api/v1/incidents/{id}/start-investigation`.
10. O analista clica em **Analisar com IA**.
11. O frontend chama `POST /api/v1/incidents/{id}/ai-analysis`.
12. O backend sanitiza os dados do erro, mensagem e metadados, removendo credenciais e dados sensíveis.
13. O backend realiza chamada HTTP autenticada à API do **OpenRouter** solicitando diagnóstico estruturado.
14. O OpenRouter retorna a análise estruturada contendo: resumo do erro, hipóteses de causa, evidências coletadas, próximos passos recomendados e nível de confiança.
15. O backend valida o esquema retornado pelo modelo, persiste os dados na tabela `ai_analyses` via Prisma e gera um evento no histórico do incidente.
16. O frontend exibe a análise assistida no card dedicado, claramente identificada como recomendação consultiva.
17. O analista avalia as recomendações, atua no sistema de origem ou ambiente afetado e redige a descrição da solução adotada.
18. O analista envia a resolução em `POST /api/v1/incidents/{id}/resolve` contendo `resolution_notes`.
19. O backend valida a nota de resolução, atualiza o status do incidente para `RESOLVED`, preenche `resolved_at`, calcula o MTTR e gera registro de auditoria.
20. O incidente é atualizado no dashboard e permanece arquivado para consultas futuras e métricas.

### Exceções

- falha de autenticação do evento: retorna `401 Unauthorized`;
- execução enviada fora da especificação: retorna `422`;
- falha ou indisponibilidade da API do OpenRouter: a API responde com erro controlado (`503`), registra a falha técnica em log, e o ciclo do incidente continua operacional normalmente para o analista investigar manualmente;
- resposta do OpenRouter fora da estrutura esperada: o backend rejeita a inserção e registra a anomalia sem comprometer o incidente;
- tentativa de resolução sem nota explicativa: retorna `422`;
- usuário sem permissão: retorna `403`.

### Resultado esperado

O incidente é recebido, diagnosticado com auxílio de IA real, tratado pelo analista e encerrado com rastreabilidade completa e métricas de MTTA e MTTR computadas.

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

Para concluir um incidente é obrigatório registrar uma descrição detalhada de resolução (`resolution_notes`). O status transita para `RESOLVED` e os timestamps de conclusão são gravados.

### RN-09 IA consultiva via OpenRouter

A análise assistida por IA é acionada pelo backend através da API do OpenRouter:

- Deve obrigatoriamente produzir formato estruturado contendo:
  - `summary` (resumo executivo do erro);
  - `likely_causes` (lista de hipóteses fundamentadas de causa-raiz);
  - `evidence` (lista de evidências extraídas dos logs e metadados);
  - `next_steps` (recomendações diagnósticas e operacionais para o analista);
  - `confidence` (grau de confiança da análise entre 0 e 1).
- É terminantemente proibido à IA:
  - alterar o status do incidente de forma autônoma;
  - executar comandos ou disparar requisições de remediação nos sistemas monitorados;
  - marcar o incidente como resolvido;
- A análise deve ser exibida na interface com alerta visual explícito indicando seu caráter consultivo;
- Todo payload retornado pelo OpenRouter é estritamente validado contra o esquema antes da persistência no banco.

---

## 5. Modelo de Dados (Prisma ORM & PostgreSQL no Supabase)

O esquema relacional é implementado e versionado via **Prisma ORM** (`prisma/schema.prisma`), conectado ao banco de dados relacional **PostgreSQL hospedado no Supabase**.

> **Regra de Isolamento de Dados:** O frontend Next.js é expressamente proibido de conectar-se diretamente ao PostgreSQL ou invocar o Supabase Data API / PostgREST para regras de negócio. Todas as operações de leitura, escrita e consulta de negócio passam exclusivamente pela API REST do backend NestJS.

### Modelos de Dados

#### User (`users`)
- `id`: UUID (PK, default uuid())
- `clerk_user_id`: String (Unique) - identificador imutável do usuário no Clerk
- `email`: String (Unique)
- `name`: String
- `role`: Enum (`ADMIN`, `ANALYST`)
- `created_at`: DateTime (default now())
- `updated_at`: DateTime (updatedAt)

#### Automation (`automations`)
- `id`: UUID (PK, default uuid())
- `name`: String
- `description`: String? (Text)
- `source_type`: String (ex: "n8n", "python_script", "step_functions")
- `criticality`: Enum (`LOW`, `MEDIUM`, `HIGH`)
- `expected_duration_seconds`: Int
- `default_owner_id`: UUID? (FK -> User.id)
- `status`: Enum (`DRAFT`, `ACTIVE`, `INACTIVE`)
- `created_by`: UUID (FK -> User.id)
- `created_at`: DateTime (default now())
- `updated_at`: DateTime (updatedAt)

#### ApiKey (`api_keys`)
- `id`: UUID (PK, default uuid())
- `automation_id`: UUID (FK -> Automation.id)
- `key_prefix`: String (prefixo público identificador, ex.: "fp_live_")
- `key_hash`: String (hash criptográfico SHA-256 do token completo)
- `status`: Enum (`ACTIVE`, `REVOKED`)
- `created_at`: DateTime (default now())
- `revoked_at`: DateTime?

#### Execution (`executions`)
- `id`: UUID (PK, default uuid())
- `automation_id`: UUID (FK -> Automation.id)
- `external_execution_id`: String?
- `status`: Enum (`STARTED`, `SUCCESS`, `FAILED`, `TIMEOUT`)
- `started_at`: DateTime
- `finished_at`: DateTime?
- `duration_seconds`: Int?
- `error_type`: String?
- `error_message`: String? (Text)
- `metadata`: Json?
- `is_test`: Boolean (default false)
- `received_at`: DateTime (default now())

#### Incident (`incidents`)
- `id`: UUID (PK, default uuid())
- `automation_id`: UUID (FK -> Automation.id)
- `primary_execution_id`: UUID (FK -> Execution.id)
- `title`: String
- `severity`: Enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `status`: Enum (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`)
- `owner_id`: UUID? (FK -> User.id)
- `error_fingerprint`: String (hash da assinatura do erro para agregação)
- `acknowledged_at`: DateTime?
- `resolved_at`: DateTime?
- `resolution_notes`: String? (Text)
- `created_at`: DateTime (default now())
- `updated_at`: DateTime (updatedAt)

#### IncidentEvent (`incident_events`)
- `id`: UUID (PK, default uuid())
- `incident_id`: UUID (FK -> Incident.id)
- `actor_user_id`: UUID? (FK -> User.id)
- `event_type`: String (ex: "CREATED", "ACKNOWLEDGED", "INVESTIGATION_STARTED", "AI_ANALYSIS_REQUESTED", "RESOLVED")
- `payload`: Json?
- `created_at`: DateTime (default now())

#### AiAnalysis (`ai_analyses`)
- `id`: UUID (PK, default uuid())
- `incident_id`: UUID (FK -> Incident.id)
- `requested_by`: UUID (FK -> User.id)
- `provider`: String (default "OpenRouter")
- `model`: String (ex: "anthropic/claude-3.5-sonnet" ou modelo configurado)
- `summary`: String (Text)
- `likely_causes`: Json (lista de causas prováveis)
- `evidence`: Json (lista de evidências dos dados)
- `next_steps`: Json (lista ordenada de recomendações diagnósticas)
- `confidence`: Decimal
- `created_at`: DateTime (default now())

#### AuditLog (`audit_logs`)
- `id`: UUID (PK, default uuid())
- `actor_user_id`: UUID? (FK -> User.id)
- `action`: String
- `resource_type`: String
- `resource_id`: UUID?
- `request_id`: String
- `trace_id`: String?
- `details`: Json?
- `created_at`: DateTime (default now())

---

## 6. Contratos de API

A API é exclusivamente RESTful, desenvolvida em NestJS e disponibilizada sob o prefixo:

```text
/api/v1
```

Formato padrão de troca de mensagens:

```text
application/json (UTF-8)
```

Autenticação de usuários: Bearer Token JWT emitido pelo Clerk no cabeçalho `Authorization`.
Autenticação de sistemas externos de origem: Chave de integração no cabeçalho `x-api-key`.

### Endpoints

#### POST /api/v1/automations
- **Objetivo:** Cadastra uma nova automação em estado `DRAFT`.
- **Controle de Acesso:** Requer autenticação Clerk com papel `ADMIN`.
- **Payload:**
```json
{
  "name": "Sincronização de Pedidos ERP",
  "description": "Workflow n8n que integra pedidos da loja ao ERP",
  "source_type": "n8n",
  "criticality": "HIGH",
  "expected_duration_seconds": 120,
  "default_owner_id": "uuid-do-usuario-opcional"
}
```

#### GET /api/v1/automations
- **Objetivo:** Lista automações cadastradas com paginação e filtros.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### GET /api/v1/automations/{id}
- **Objetivo:** Obtém os dados detalhados de uma automação específica.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### POST /api/v1/automations/{id}/api-keys
- **Objetivo:** Gera credencial de integração para a automação.
- **Controle de Acesso:** Requer papel `ADMIN`.
- **Resposta:** Devolve a chave em texto plano (`fp_live_...`) uma única vez. O backend persiste exclusivamente o hash SHA-256 da chave.

#### POST /api/v1/automations/{id}/activate
- **Objetivo:** Ativa o monitoramento da automação após a realização de pelo menos um teste válido.
- **Controle de Acesso:** Requer papel `ADMIN`.
- **Resposta:** Retorna a automação com status atualizado para `ACTIVE`.

#### POST /api/v1/executions
- **Objetivo:** Recebe eventos de execução emitidos por automações externas.
- **Autenticação:** Cabeçalho `x-api-key` contendo a credencial da automação.
- **Exemplo de Payload:**
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
    "environment": "production",
    "workflow_id": "wf-orders-01"
  },
  "is_test": false
}
```
- **Resposta válida:**
```json
{
  "execution_id": "018e38f4-2f2b-7128-98e3-0d5bdf161111",
  "accepted": true,
  "incident_id": "018e38f4-2f2b-7128-98e3-0d5bdf162222"
}
```

#### GET /api/v1/executions
- **Objetivo:** Consulta histórico de execuções com filtros por automação, status (`STARTED`, `SUCCESS`, `FAILED`, `TIMEOUT`), período e flag de teste.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### GET /api/v1/incidents
- **Objetivo:** Lista incidentes com paginação e filtros (status, severidade, automação, responsável, período).
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### GET /api/v1/incidents/{id}
- **Objetivo:** Retorna o detalhe completo do incidente, dados da execução primária, eventos da linha do tempo (`incident_events`) e análises de IA já realizadas.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### POST /api/v1/incidents/{id}/acknowledge
- **Objetivo:** Atribui o analista autenticado como responsável e transita o status para `ACKNOWLEDGED`.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### POST /api/v1/incidents/{id}/start-investigation
- **Objetivo:** Altera o status do incidente para `INVESTIGATING`.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

#### POST /api/v1/incidents/{id}/ai-analysis
- **Objetivo:** Dispara a análise assistida de diagnóstico chamando o provedor OpenRouter via backend.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.
- **Resposta esperada:**
```json
{
  "id": "018e38f4-2f2b-7128-98e3-0d5bdf163333",
  "incident_id": "018e38f4-2f2b-7128-98e3-0d5bdf162222",
  "provider": "OpenRouter",
  "model": "anthropic/claude-3.5-sonnet",
  "summary": "A execução falhou por indisponibilidade de conexão com o banco de dados de destino durante a etapa de sincronização de pedidos.",
  "likely_causes": [
    "Instância do PostgreSQL atingiu limite máximo de conexões simultâneas.",
    "Sobrecarga temporária de rede ou reinicialização do pooler de conexões."
  ],
  "evidence": [
    "Mensagem de erro explícita: Connection timeout after 30 seconds.",
    "Duração total da execução (135s) superior ao limiar configurado (120s)."
  ],
  "next_steps": [
    "Verificar a métrica de conexões ativas na instância do banco de dados.",
    "Validar se o serviço de pooler de conexão está operacional e aceitando novas sessões.",
    "Checar se houve deadlock ou consultas bloqueantes no momento da execução."
  ],
  "confidence": 0.88,
  "created_at": "2026-09-20T10:33:00Z"
}
```

#### POST /api/v1/incidents/{id}/resolve
- **Objetivo:** Conclui o tratamento do incidente, transitando o status para `RESOLVED`.
- **Controle de Acesso:** `ADMIN` e `ANALYST`.
- **Payload:**
```json
{
  "resolution_notes": "Reiniciado o pool de conexões e aumentado o limite de instâncias no PgBouncer. Execução retestada com sucesso."
}
```

#### GET /api/v1/dashboard/summary
- **Objetivo:** Fornece os indicadores operacionais agregados para o dashboard (total de execuções, taxa de sucesso, incidentes abertos, incidentes críticos, MTTA e MTTR médios).
- **Controle de Acesso:** `ADMIN` e `ANALYST`.

---

## 7. Tratamento de Erros

Respostas de erro seguem o padrão RFC 7807 (Problem Details for HTTP APIs):

```json
{
  "type": "https://flowpulse.app/errors/validation",
  "title": "Dados inválidos",
  "status": 422,
  "detail": "O campo status possui valor inválido.",
  "instance": "/api/v1/executions",
  "request_id": "req_c3a1b89d4ef7",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

Códigos de status HTTP utilizados:
- `400 Bad Request`: sintaxe de requisição malformada;
- `401 Unauthorized`: token Clerk ausente/inválido ou credencial de API inexistente;
- `403 Forbidden`: permissão RBAC insuficiente para o recurso;
- `404 Not Found`: recurso solicitado não encontrado;
- `409 Conflict`: transição de estado ilegal ou recurso com conflito de unicidade;
- `422 Unprocessable Entity`: falha na validação semântica dos dados de entrada (NestJS ValidationPipe);
- `429 Too Many Requests`: limite de requisições excedido;
- `500 Internal Server Error`: falha interna não tratada;
- `503 Service Unavailable`: dependência externa temporariamente inacessível (ex: OpenRouter).

---

## 8. Segurança e Privacidade

- **Autenticação:** Gerenciada externamente pelo Clerk. O backend NestJS utiliza Guards para validação dos tokens JWT e verificação de assinatura contra o JWKS do Clerk;
- **Autorização (RBAC):** Perfis `ADMIN` e `ANALYST` aplicados e validados estritamente no backend através de decorators e guards;
- **Isolamento de Dados:** O frontend Next.js é estritamente impedido de acessar o banco de dados diretamente ou via Supabase Data API / PostgREST. Todas as leituras e gravações de negócio são mediadas pela API REST do NestJS;
- **Credenciais de Integração:** Tokens de API recebem hashing com algoritmo seguro (SHA-256). Apenas o hash e um prefixo público identificável são mantidos no banco;
- **Segredos e Configurações:** Nenhuma chave secreta ou credencial é versionada no repositório Git. Variáveis de ambiente (`.env`) centralizam as configurações em todos os ambientes;
- **Proteção em Trânsito:** Protocolo HTTPS/TLS obrigatório em todas as comunicações remotas;
- **Sanitização de IA:** Payloads de erro e metadados enviados à API do OpenRouter sofrem sanitização prévia para remoção de senhas, tokens de autorização e dados pessoais sensíveis;
- **Auditoria:** Operações de cadastro, revogação de chave, atribuição de responsável, transição de status de incidente e registro de resolução geram entradas imutáveis na tabela `audit_logs`.

---

## 9. Observabilidade e Rastreabilidade

Cada requisição processada pelo NestJS é correlacionada e rastreada:
- **Identificadores Únicos:** `request_id` (injetado por middleware) e `trace_id` (gerado/propagado pelo OpenTelemetry);
- **OpenTelemetry:** Instrumentação automática para HTTP/REST, Prisma ORM e chamadas externas para o OpenRouter;
- **Logs Estruturados:** Formatação em JSON estruturado (timestamp ISO, level, service, environment, trace_id, request_id, event_name, payload contextual);
- **Trilha de Auditoria:** Eventos críticos do ciclo de vida das entidades persistidos com identificação do ator, ação e data/hora.

---

## 10. Critérios de Aceite Técnicos

### FLUXO 1 - Integração de uma Automação
- O usuário realiza login com perfil `ADMIN` via Clerk;
- Cria uma nova automação com nome, criticidade e duração limite esperada;
- Solicita a geração da credencial de integração e recebe o token de uso único;
- Dispara uma requisição de teste real contra `POST /api/v1/executions` com `is_test: true` e a credencial emitida;
- O backend NestJS autentica a requisição via hash SHA-256 e persiste o teste via Prisma no PostgreSQL do Supabase;
- A interface Next.js confirma o teste e permite acionar a ativação (`POST /api/v1/automations/{id}/activate`);
- A automação transita para `ACTIVE` e passa a aceitar eventos produtivos sem necessidade de qualquer ajuste manual em banco.

### FLUXO 2 - Tratamento de Incidente
- Uma execução com falha (`status: "failed"`) é enviada para `POST /api/v1/executions`;
- A API persiste o evento e o motor de regras cria automaticamente o incidente com a severidade correspondente;
- O analista visualiza o incidente na fila e aciona **Assumir** (`POST /api/v1/incidents/{id}/acknowledge`), tornando-se o responsável e alterando o status para `ACKNOWLEDGED`;
- O analista move para `INVESTIGATING` e aciona **Analisar com IA** (`POST /api/v1/incidents/{id}/ai-analysis`);
- O backend NestJS sanitiza os dados e realiza uma chamada real à API do OpenRouter;
- A resposta é validada no esquema estruturado (`summary`, `likely_causes`, `evidence`, `next_steps`, `confidence`) e persistida em `ai_analyses`;
- A IA não altera o status do incidente nem executa remediações automáticas;
- O analista insere as notas de solução e conclui o incidente (`POST /api/v1/incidents/{id}/resolve`);
- O status é atualizado para `RESOLVED`, os indicadores MTTA e MTTR são calculados e o histórico completo fica auditado.

### Testabilidade e Qualidade
- Suíte de testes unitários com Jest cobrindo regras de negócio e cálculo de severidade;
- Suíte de testes de integração com Supertest e Jest cobrindo os endpoints protegidos e validações de esquema da API NestJS;
- Suíte de testes ponta a ponta (E2E) com Playwright cobrindo integralmente o FLUXO 1 e o FLUXO 2 no frontend Next.js;
- Execução obrigatória de linting (ESLint/Prettier) e build check em pipelines de CI/CD.

---

## 11. Fora do MVP

- Remediação automática ou autônoma de workflows pela IA sem intervenção humana;
- Execução de comandos arbitrários no sistema operacional ou em pipelines pelo modelo de linguagem;
- Acesso direto do frontend Next.js ao banco de dados ou ao Supabase Data API;
- Múltiplos tenants comerciais isolados;
- Sistema de cobrança, planos ou faturamento;
- Aplicativos móveis nativos (iOS/Android);
- Conectores proprietários dedicados para cada ferramenta de mercado (a integração inicial é padronizada via API REST).
