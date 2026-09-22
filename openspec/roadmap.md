# FlowPulse — Roadmap Incremental

> Decomposição definitiva aprovada em 21/09/2026.
> Cada change é autossuficiente: inclui seus próprios testes unitários e de integração antes de ser considerado concluído.

---

## Sequência de Entrega

```
01-project-foundation
        |
        v
02-auth-rbac
        |
        v
03-automation-integration      <-- Fluxo 1 completo
        |
        v
04-incident-lifecycle-ai       <-- Fluxo 2 (sem dashboard)
        |
        v
05-dashboard-metrics           <-- Dashboard, MTTA, MTTR, filtros
        |
        v
06-observability-quality       <-- OTel, auditoria, E2E Playwright, quality gates
        |
        v
07-container-iac-deployment    <-- Docker, Terraform, GitHub Actions, deploy
```

---

## Changes

| # | Change | Escopo central | Depende de |
|---|--------|----------------|------------|
| 01 | `01-project-foundation` | Monorepo, tooling, schema Prisma mínimo (`users`), Docker Compose base | — |
| 02 | `02-auth-rbac` | Clerk JWT, RBAC ADMIN/ANALYST, sincronização local de usuário | 01 |
| 03 | `03-automation-integration` | Automations, ApiKeys (SHA-256), Executions, ApiKeyGuard, criação automática de incidente OPEN — **Fluxo 1** | 02 |
| 04 | `04-incident-lifecycle-ai` | Ciclo de vida do incidente (OPEN → RESOLVED), OpenRouter real, ai_analyses — **Fluxo 2** (sem dashboard) | 03 |
| 05 | `05-dashboard-metrics` | Dashboard, resumo operacional, MTTA, MTTR, filtros e agregações | 04 |
| 06 | `06-observability-quality` | OpenTelemetry, logs JSON, request_id/trace_id, auditoria complementar, Playwright E2E (Fluxo 1 + Fluxo 2), WCAG 2.1 AA, quality gates | 05 |
| 07 | `07-container-iac-deployment` | Dockerfiles OCI multi-stage, Docker Compose produtivo, Terraform (apply), GitHub Actions CI/CD, smoke tests | 06 |

---

## Regras Globais

- **Schema Prisma incremental:** cada change migra apenas as entidades que implementa (`prisma migrate dev`). Nunca antecipar tabelas de módulos futuros.
- **Testes por change:** unitários (Jest) e integração (Supertest) são obrigatórios no próprio change. O change 06 adiciona cobertura complementar E2E (Playwright) e quality gates de CI, não substitui testes dos changes anteriores.
- **Closure:** um change só é considerado concluído quando `npm run test && npm run typecheck && npm run lint && npm run build` passam com código de saída zero.
- **ApiKeyGuard:** pertence ao change 03, não ao 02.
- **Dashboard e métricas MTTA/MTTR:** pertence ao change 05, não ao 04.
- **Terraform:** evidência de implantação automatizada requer `terraform apply` executável e smoke tests passando no CI, não apenas `terraform plan` ou documentação.
- **IA (OpenRouter):** estritamente consultiva — nunca altera status de incidente nem executa remediações automáticas.

---

## Referências

- `@docs/prd.md` — Requisitos de produto, personas, escopo MVP
- `@docs/spec.md` — Especificação técnica, contratos de API, Fluxo 1 e Fluxo 2
- `@docs/architecture.md` — Decisões arquiteturais, stack, segurança, RNFs
- `@AGENTS.md` — Governança operacional, regras de closure, never-do list
