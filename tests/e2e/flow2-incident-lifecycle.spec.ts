import { test, expect } from '@playwright/test';
import * as http from 'http';
import { startOpenRouterMock, stopOpenRouterMock } from './helpers/openrouter-mock';

test.describe('E2E — Fluxo 2: Ciclo de Incidente e IA Consultiva', () => {
  let mockServer: http.Server;

  test.beforeAll(async () => {
    mockServer = await startOpenRouterMock({ port: 3002 });
  });

  test.afterAll(async () => {
    if (mockServer) {
      await stopOpenRouterMock(mockServer);
    }
  });

  test.beforeEach(async () => {
    if (!process.env.E2E_CLERK_USER_EMAIL) {
      test.skip(true, 'Variável de ambiente E2E_CLERK_USER_EMAIL não configurada.');
    }
  });

  test('executa com sucesso o ciclo completo de incidente, assunção, investigação, análise de IA e resolução', async ({
    page,
    request,
  }) => {
    // 1. Criar e ativar uma automação via UI para viabilizar geração de incidente
    await page.goto('/automations/new');
    const autoName = `E2E Incident Test ${Date.now()}`;
    await page.locator('[data-testid="automation-name-input"]').fill(autoName);
    await page.locator('[data-testid="automation-criticality-select"]').selectOption('HIGH');
    await Promise.all([
      page.waitForURL(
        (url) => {
          const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname;
          return /^\/automations\/[^/]+$/.test(pathname) && pathname !== '/automations/new';
        },
        { timeout: 20000 },
      ),
      page.locator('[data-testid="submit-automation-button"]').click(),
    ]);
    await expect(page.locator('h1')).toContainText(autoName);

    // Gera credencial
    await page.locator('[data-testid="generate-key-button"]').click();
    await page.locator('[data-testid="confirm-generate-key-button"]').click();
    const secretInput = page.locator('[data-testid="volatile-secret-input"]');
    await expect(secretInput).toBeVisible({ timeout: 10000 });
    const apiKey = await secretInput.inputValue();
    await page.locator('[data-testid="close-secret-modal-button"]').click();

    // Validação com execução de teste prévia
    await request.post('http://localhost:3001/api/v1/executions', {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      data: {
        external_execution_id: `e2e-setup-val-${Date.now()}`,
        status: 'SUCCESS',
        started_at: new Date(Date.now() - 2000).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 1000,
        is_test: true,
      },
    });

    await page.reload();
    await page.locator('[data-testid="activate-automation-button"]').click();
    await expect(page.locator('[data-testid="status-badge-active"]').first()).toBeVisible({
      timeout: 15000,
    });

    // 2. Envia execução produtiva com status FAILED gerando incidente OPEN
    const failedResponse = await request.post('http://localhost:3001/api/v1/executions', {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      data: {
        external_execution_id: `e2e-prod-fail-${Date.now()}`,
        status: 'FAILED',
        error_message: 'Fatal timeout: downstream payment service unreachable after 30s',
        started_at: new Date(Date.now() - 5000).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 30000,
        is_test: false,
      },
    });

    expect(failedResponse.ok()).toBeTruthy();
    const failedBody = await failedResponse.json();
    expect(failedBody.incident_id).toBeTruthy();
    const incidentId = failedBody.incident_id;

    // 3. Localiza o incidente na página /incidents
    await page.goto('/incidents');
    const incidentLink = page.locator(`a[href*="/incidents/${incidentId}"]`);
    await expect(incidentLink).toBeVisible({ timeout: 15000 });
    await incidentLink.click();

    // 4. Verifica status inicial OPEN
    await page.waitForURL(new RegExp(`/incidents/${incidentId}`), { timeout: 15000 });
    await expect(page.getByTestId('incident-status-badge-open').first()).toBeVisible();

    // 5. Clica em "Assumir Incidente" e verifica transição para ACKNOWLEDGED
    const ackButton = page.locator('[data-testid="btn-acknowledge"]');
    await expect(ackButton).toBeVisible();
    await ackButton.click();
    await expect(page.getByTestId('incident-status-badge-acknowledged').first()).toBeVisible({
      timeout: 10000,
    });

    // 6. Clica em "Iniciar Investigação" e verifica transição para INVESTIGATING
    const investButton = page.locator('[data-testid="btn-investigate"]');
    await expect(investButton).toBeVisible();
    await investButton.click();
    await expect(page.getByTestId('incident-status-badge-investigating').first()).toBeVisible({
      timeout: 10000,
    });

    // 7. Solicita Análise com IA contra o mock determinístico
    const aiButton = page.locator('[data-testid="btn-request-ai"]');
    await expect(aiButton).toBeVisible();
    await aiButton.click();

    // Verifica renderização do card de IA com rotulagem consultiva
    const aiContainer = page.locator('[data-testid="ai-analyses-container"]');
    await expect(aiContainer).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Consultiva').first()).toBeVisible();
    await expect(
      page.locator('text=Falha de comunicação detectada durante a execução da automação.').first(),
    ).toBeVisible();

    // 8. Aciona "Resolver Incidente"
    const resolveButton = page.locator('[data-testid="btn-resolve"]');
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();

    // 9. Preenche notas de resolução (mínimo 10 caracteres)
    const notesInput = page.locator('[data-testid="resolution-notes-textarea"]');
    await expect(notesInput).toBeVisible();
    await notesInput.fill(
      'Incidente diagnosticado e mitigado com reinício da conexão de rede e reprocessamento.',
    );

    // Confirma resolução
    const confirmResolveBtn = page.locator('[data-testid="btn-confirm-resolve"]');
    await expect(confirmResolveBtn).toBeEnabled();
    await confirmResolveBtn.click();

    // 10. Verifica status RESOLVED e timeline de eventos
    await expect(page.getByTestId('incident-status-badge-resolved').first()).toBeVisible({
      timeout: 15000,
    });

    const timelineRegion = page.locator(
      '[role="region"][aria-labelledby="timeline-heading"], section[aria-labelledby="timeline-heading"]',
    );
    await expect(timelineRegion).toBeVisible();
  });
});
