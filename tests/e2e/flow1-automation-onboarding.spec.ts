import { test, expect } from '@playwright/test';

test.describe('E2E — Fluxo 1: Onboarding e Ativação de Automação', () => {
  test.beforeEach(async () => {
    if (!process.env.E2E_CLERK_USER_EMAIL) {
      test.skip(true, 'Variável de ambiente E2E_CLERK_USER_EMAIL não configurada.');
    }
  });

  test('executa com sucesso o ciclo completo de onboarding, emissão de credencial e ativação', async ({
    page,
    request,
  }) => {
    // 1. Navega para tela de cadastro de automação
    await page.goto('/automations/new');
    await expect(page).toHaveURL(/\/automations\/new/);

    const autoName = `E2E Pipeline Onboarding ${Date.now()}`;
    const autoDesc = 'Automação criada no Fluxo 1 E2E com criticidade HIGH';

    // 2. Preenchimento de dados
    await page.locator('[data-testid="automation-name-input"]').fill(autoName);
    await page.locator('[data-testid="automation-description-input"]').fill(autoDesc);
    await page.locator('[data-testid="automation-criticality-select"]').selectOption('HIGH');
    await page.locator('[data-testid="automation-duration-input"]').fill('60');

    // 3. Submissão e redirecionamento para a tela de detalhes
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

    // 4. Solicitação e confirmação de chave de API
    const generateBtn = page.locator('[data-testid="generate-key-button"]');
    await expect(generateBtn).toBeVisible({ timeout: 10000 });
    await generateBtn.click();

    const confirmModal = page.locator('[data-testid="generate-confirm-modal"]');
    await expect(confirmModal).toBeVisible();
    await page.locator('[data-testid="confirm-generate-key-button"]').click();

    // 5. Modal de exibição única da chave
    const secretInput = page.locator('[data-testid="volatile-secret-input"]');
    await expect(secretInput).toBeVisible({ timeout: 10000 });

    // Copia chave estritamente em memória da execução de teste
    const apiKey = await secretInput.inputValue();
    expect(apiKey).toMatch(/^fp_live_[a-zA-Z0-9_-]{32,}$/);

    // Fecha modal de credencial única
    await page.locator('[data-testid="close-secret-modal-button"]').click();
    await expect(secretInput).not.toBeVisible();

    // 6. Chamada de API: POST /api/v1/executions com is_test: true
    const executionResponse = await request.post('http://localhost:3001/api/v1/executions', {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        external_execution_id: `e2e-onboarding-test-${Date.now()}`,
        status: 'SUCCESS',
        started_at: new Date(Date.now() - 3000).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 1500,
        is_test: true,
      },
    });

    expect(executionResponse.ok()).toBeTruthy();
    const executionData = await executionResponse.json();
    expect(executionData).toHaveProperty('id');
    expect(executionData.is_test).toBe(true);

    // 7. Atualiza dados na tela para refletir status VALIDATED
    await page.reload();
    const validatedBadge = page.locator('[data-testid="integration-badge-validated"]').first();
    await expect(validatedBadge).toBeVisible({ timeout: 15000 });

    // 8. O botão "Ativar Monitoramento" deve estar habilitado
    const activateBtn = page.locator('[data-testid="activate-automation-button"]');
    await expect(activateBtn).toBeEnabled({ timeout: 10000 });
    await activateBtn.click();

    // 9. Confere status ACTIVE
    const activeBadge = page.locator('[data-testid="status-badge-active"]').first();
    await expect(activeBadge).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="deactivate-automation-button"]')).toBeVisible();
  });
});
