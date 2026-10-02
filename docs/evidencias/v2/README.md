# Checklist de Evidências Gráficas — Entrega V2

Este diretório armazena as capturas de tela e evidências visuais comprobatórias do Projeto Incremental V2 do FlowPulse para avaliação acadêmica.

As capturas de tela devem ser inseridas manualmente nesta pasta de acordo com a nomenclatura padronizada e os critérios descritos abaixo:

| Arquivo | Descrição e Critério de Visibilidade |
|---|---|
| `01-dashboard-producao.png` | Tela `/dashboard` em produção exibindo cards de métricas (MTTA, MTTR, execuções, taxa de falha) e gráficos consolidados com dados reais. |
| `02-automacoes-active.png` | Tela `/automations` em produção exibindo a listagem de automações com badge de status `ACTIVE` e integração validada. |
| `03-incidente-ia.png` | Tela `/incidents/[id]` em produção com o card de diagnóstico de IA visível, destacando o rótulo consultivo e a timeline imutável de eventos. |
| `04-health-producao.png` | Navegador ou cURL acessando `https://flowpulse.viniciusbarroso.com.br/health` com resposta HTTP 200 e payload `{"status":"ok"}`. |
| `05-github-actions-ci-cd.png` | Console do GitHub Actions mostrando a execução bem-sucedida (status verde) dos workflows `ci.yml` e `deploy.yml` na branch `main`. |
| `06-ecs-services-healthy.png` | Console da AWS ECS Fargate mostrando o cluster `flowpulse-production` com os serviços `api` e `web` em estado `ACTIVE` e tasks com `HealthStatus: HEALTHY`. |
| `07-alb-listeners-targets.png` | Console da AWS EC2/ALB mostrando os listeners nas portas 80 (HTTP 301 redirect) e 443 (HTTPS com certificado ACM) e Target Groups saudáveis. |
| `08-terraform-secret-canary.png` | Terminal executando `./scripts/verify-terraform-secrets.sh` com resultado `PASS`, comprovando zero persistência de segredos no estado. |
| `09-openspec-validation.png` | Terminal executando `npx openspec validate --all --strict` com saída `Totals: 29 passed, 0 failed`. |
| `10-testes-automatizados.png` | Terminal executando `npm run test` e `npm run test:e2e` exibindo a aprovação de todas as 38 suítes (206 testes Jest) e 6 testes E2E do Playwright. |
