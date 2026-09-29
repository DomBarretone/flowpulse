# AGENTS.md - FlowPulse Operational Guidelines

Diretrizes operacionais, arquiteturais e de governança para agentes de IA no FlowPulse. Priorize comandos diretos, políticas executáveis e código conciso.

## 1. Comportamento Geral (Karpathy Guidelines)
- **Think Before Coding:** Explicite premissas. Se houver ambiguidade ou alternativa mais simples, pergunte antes de codificar.
- **Simplicity First:** Entregue o mínimo código que resolve a tarefa. Zero abstrações especulativas ou flexibilidade não solicitada.
- **Surgical Changes:** Edite apenas o estritamente necessário. Remova órfãos criados pela sua mudança; nunca refatore código adjacente.
- **Goal-Driven Execution:** Defina critérios verificáveis. Para bugs, reproduza com teste antes e confirme a correção com teste passando.

## 2. Stack Tecnológica & Estrutura
- **Frontend (`apps/web`):** Next.js (App Router), TypeScript (modo estrito), Tailwind CSS, shadcn/ui, `@clerk/nextjs`, Fetch API / TanStack Query.
- **Backend (`apps/api`):** NestJS, TypeScript (modo estrito), API RESTful sob `/api/v1`, `@nestjs/swagger`, `class-validator`, `class-transformer` (`ValidationPipe`), RFC 7807 (*Problem Details*), Prisma ORM, `@clerk/backend`, OpenTelemetry.
- **Persistência:** PostgreSQL no Supabase via Prisma ORM com migrações versionadas (`prisma migrate dev`). Frontend estritamente proibido de acessar o banco diretamente ou via PostgREST / Supabase Data API.
- **IA:** OpenRouter integrado exclusivamente no backend para análise assistida consultiva de incidentes.
- **Testes & Infra:** Jest (unitários), Supertest com Jest (integração), Playwright (`tests/e2e`), Docker (OCI multi-stage), Docker Compose, Terraform (`infra/terraform`).

## 3. Comandos Principais (Root Scripts)
Comandos canônicos da raiz (*marcados com `*` conforme o scaffolding do monorepo for consolidado*):
```bash
# Setup inicial
npm install && cp .env.example .env && bash scripts/check-environment.sh

# Banco de Dados (Prisma)
npm run db:generate   # * npx prisma generate no backend
npm run db:migrate    # * npx prisma migrate dev no backend (NUNCA usar db push)

# Build e Desenvolvimento
npm run dev           # * executa web e api concorrentemente em desenvolvimento
npm run build         # * compila todos os pacotes e aplicações (next build e nest build)

# Testes e Qualidade
npm run test          # * executa testes unitários e de integração
npm run test:e2e      # * executa testes E2E dos Fluxos 1 e 2 via Playwright
npm run typecheck     # * validação estática de tipos via tsc --noEmit
npm run lint          # * validação estática e formatação via eslint e prettier
```

## 4. Governança e Autonomia no Terminal
- **Always do (Autonomia total):**
  - Executar linters, checagens estáticas de tipo (`tsc --noEmit`) e testes antes de submeter qualquer alteração.
  - Mockar dependências externas (OpenRouter, Clerk, Supabase) em testes unitários e de integração.
  - Sanitizar dados (remover senhas, tokens e PII) antes de chamadas ao OpenRouter e nos blocos de exibição de log.
  - Validar DTOs na entrada da API com `ValidationPipe` e respostas de erro no padrão RFC 7807.
  - Persistir trilha de auditoria em `audit_logs` e eventos em `incident_events` para mudanças críticas de estado.
  - Garantir acessibilidade WCAG 2.1 AA na interface (status combinando texto + cor + ícone, foco visível, navegação por teclado).
- **Ask first (Confirmação obrigatória):**
  - Migrations destrutivas ou com risco de perda de dados (`prisma migrate reset`, remoção de tabelas/colunas).
  - Alterações em contratos públicos de endpoints `/api/v1` ou no schema do banco de dados (`schema.prisma`).
  - Instalação de novas dependências ou pacotes npm pesados.
- **Never do (Terminantemente proibido):**
  - NUNCA executar `git push --force`, `git reset --hard` ou comandos destrutivos no git/filesystem sem confirmação expressa.
  - NUNCA utilizar `prisma db push` (todas as alterações de banco devem ser migrações versionadas via `prisma migrate`).
  - NUNCA registrar tokens, secrets, credenciais ou dados sensíveis em logs ou no git (mantenha em `.env`).
  - NUNCA persistir API keys em texto plano no banco de dados (armazene exclusivamente o hash SHA-256; exiba a chave `fp_live_...` apenas uma vez).
  - NUNCA editar diretamente dados de produção ou rodar comandos fora do escopo de desenvolvimento local.
  - NUNCA permitir que o frontend acesse o banco de dados diretamente ou via Supabase Data API (use sempre `/api/v1`).
  - NUNCA permitir que a IA (OpenRouter) tome ações ativas, altere status de incidentes ou execute comandos em produção.
  - NUNCA permitir resolução de incidente (`POST /api/v1/incidents/{id}/resolve`) sem nota explicativa obrigatória (`resolution_notes`).

## 5. Inteligência Artificial (OpenRouter)
- A análise de causa-raiz é **estritamente consultiva**; o analista humano é quem decide e resolve o incidente.
- O backend deve obrigatoriamente sanitizar payloads de erro e logs/metadados antes de enviar ao OpenRouter.
- Respostas da IA devem ser validadas contra o schema esperado antes da persistência na tabela `ai_analyses`:
  - `summary` (string): resumo executivo do erro;
  - `likely_causes` (array/json): hipóteses fundamentadas de causa-raiz;
  - `evidence` (array/json): evidências extraídas dos logs e metadados;
  - `next_steps` (array/json): recomendações diagnósticas operacionais;
  - `confidence` (number): grau de confiança entre 0 e 1.
- Falha, indisponibilidade (`503`) ou resposta inválida da IA **nunca** pode travar ou impedir o fluxo manual de investigação e resolução.

## 6. Observabilidade e Auditoria
- **Logs Estruturados (JSON via OpenTelemetry/Pino):**
  Devem ser emitidos contendo: `timestamp`, `level`, `service`, `environment`, `trace_id`, `request_id`, `event_name` e contexto da requisição.
- **Trilha de Auditoria Relacional:**
  Operações de cadastro, revogação de chave, atribuição de responsável, transições de status de incidentes e resoluções devem obrigatoriamente gerar registros imutáveis nas tabelas `audit_logs` e `incident_events`.

## 7. Estratégia de Testes e Critério de Conclusão (Closure)
Uma tarefa só pode ser considerada concluída se todas as verificações aplicáveis passarem com código de saída zero:
```bash
npm run test && npm run typecheck && npm run lint && npm run build
```
- **Se a tarefa alterar os Fluxos 1 ou 2:** A execução de `npm run test:e2e` (Playwright) é obrigatória.
- **Unitários (Jest):** Cobrir regras de cálculo de severidade (RN-04), transição de estados (RN-05), sanitização e cálculo de MTTA/MTTR.
- **Integração (Supertest):** Cobrir autenticação Clerk JWT, autorização RBAC (`ADMIN` vs `ANALYST`), autenticação por hash SHA-256 e mock de resposta/falha `503` do OpenRouter.

## 8. Consulta de Documentação e Ferramental MCP (Context7)
- Para validar sintaxes e APIs atuais (Next.js App Router, NestJS, Prisma, Clerk, Playwright, Tailwind, OpenRouter), consulte a documentação oficial via **Context7 MCP** (`mcp:context7`) sempre que a ferramenta estiver disponível na sessão.
- Caso o MCP Context7 não esteja disponível no ambiente atual, utilize as ferramentas nativas de busca (`search_web` / `read_url_content`) ou os arquivos normativos em `@docs`. Evite suposições e bibliotecas desatualizadas.

## 9. Tabela de Decisão Operacional
| Cenário | Decisão Arquitetural |
|---|---|
| Regras de transição de status e severidade | Backend NestJS (`apps/api`), nunca duplicadas no Frontend. |
| Consumo de dados pelo Frontend | Exclusivamente via API REST sob `/api/v1` com JWT do Clerk. |
| Ingestão de execuções externas | `POST /api/v1/executions` autenticada pelo hash SHA-256 de `x-api-key`. |
| Resposta de erro da API | Formato RFC 7807 (*Problem Details*) contendo `request_id` e `trace_id`. |
| Indisponibilidade do provedor de IA | Responder com erro tratado (`503`), registrar log e manter investigação manual. |
| Resolução de incidente | Exige obrigatoriamente payload com `resolution_notes`. |

## 10. Referências do Projeto
- `@docs/problem.md`: Problema, público-alvo e métricas operacionais (MTTA, MTTR).
- `@docs/prd.md`: Requisitos de produto, personas e módulos do sistema.
- `@docs/spec.md`: Especificação técnica, contratos da API REST e fluxos centrais (Fluxo 1 e 2).
- `@docs/architecture.md`: Decisões de arquitetura, stack, segurança e rastreabilidade dos RNFs.
- `@docs/design.md`: Tokens de design system, paleta escura e acessibilidade WCAG.
- `@docs/environment-setup.md`: Setup local, OpenCode, OmniRoute e scripts de ambiente.

## 11. Aprendizado Contínuo (Post-Task Reflection)
Ao término de cada entrega ou mudança relevante, inclua no fechamento da resposta:
1. **O que funcionou:** Síntese da solução aplicada e verificações que passaram.
2. **Dificuldades/Gaps:** Pontos de atrito encontrados ou dívidas técnicas notadas.
3. **Sugestão de melhoria:** Recomendação prática e direta para o código, arquitetura ou para este `AGENTS.md`.
