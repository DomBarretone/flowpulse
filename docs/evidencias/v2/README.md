# Checklist de Evidências Gráficas — Entrega V2

Este diretório armazena as capturas de tela e evidências visuais comprobatórias do Projeto Incremental V2 do FlowPulse para avaliação acadêmica.

As capturas de tela devem ser inseridas manualmente nesta pasta de acordo com a nomenclatura padronizada e os critérios descritos abaixo:

| Arquivo | Descrição e Critério de Visibilidade |
|---|---|
| `01-dashboard-producao.png` | Tela `/dashboard` em produção exibindo cards de métricas operacionais consolidadas com dados reais: 1 automação ativa, 5 execuções, 80% de taxa de sucesso, 1 falha, 0 incidentes abertos, MTTA 55s e MTTR 2m 50s. |
| `02-automacoes-active.png` | Tela `/automations` em produção exibindo a automação "Sincronização de Pedidos ERP" com badge de status `ACTIVE` e integração `VALIDATED`. |
| `03-incidente-ia.png` | Tela `/incidents/[id]` em produção com o card de diagnóstico consultivo de IA visível (modelo `anthropic/claude-haiku-4.5`, confiança de 72%), destacando o rótulo consultivo, causas prováveis e timeline imutável de eventos. |
| `04-health-producao.png` | Navegador ou cURL acessando `https://flowpulse.viniciusbarroso.com.br/health` com resposta HTTP 200 e payload `{"status":"ok"}`. |
| `05-github-actions-ci-cd.png` | Console do GitHub Actions mostrando a execução bem-sucedida (status verde) dos workflows `ci.yml` e `deploy.yml` na branch `main`. |
| `06-ecs-services-healthy.png` | Console da AWS ECS Fargate mostrando o cluster `flowpulse-production` com os serviços `api` e `web` em estado `ACTIVE` e tasks com `HealthStatus: HEALTHY`. |
| `07-alb-listeners-targets.png` | Console AWS EC2/ALB mostrando: listener HTTP 80 com redirect 301, listener HTTPS 443 com certificado ACM e Target Groups Web/API saudáveis. |
| `08-terraform-secret-canary.png` | Terminal executando `./scripts/verify-terraform-secrets.sh` com resultado `PASS`, comprovando zero persistência de segredos no estado. |
| `09-openspec-validation.png` | Terminal executando `npx openspec validate --all --strict` com saída `Totals: 29 passed, 0 failed`. |
| `10-testes-automatizados.png` | Terminal executando `npm run test` e `npm run test:e2e` exibindo a aprovação de todas as 38 suítes (211 testes Jest) e 6 testes E2E do Playwright. |
| `11-incidente-resolvido.png` | Tela `/incidents/[id]` exibindo o incidente de criticidade `CRITICAL` em status `RESOLVED`, responsável Vinicius Barroso, timestamps e nota explicativa de resolução. |
| `12-dashboard-graficos.png` | Gráficos do Dashboard exibindo a série temporal e distribuição de execuções produtivas (4 sucessos, 1 falha, 0 timeouts), comprovando o isolamento de execuções de teste (`is_test = true`). |
