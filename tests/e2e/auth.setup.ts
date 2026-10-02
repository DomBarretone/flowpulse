import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = path.resolve(__dirname, '../../playwright/.auth/user.json');

// O setup do Clerk precisa executar antes da autenticação.
setup.describe.configure({ mode: 'serial' });

setup('configure Clerk testing', async () => {
  // O projeto Next.js normalmente usa NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
  // @clerk/testing espera CLERK_PUBLISHABLE_KEY.
  if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  }

  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      'CLERK_PUBLISHABLE_KEY ou NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY precisa estar configurada.',
    );
  }

  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY precisa estar configurada para os testes E2E.');
  }

  await clerkSetup();
});

setup('authenticate via Clerk', async ({ page }) => {
  const email = process.env.E2E_CLERK_USER_EMAIL;

  if (!email) {
    throw new Error('E2E_CLERK_USER_EMAIL precisa estar configurado para executar os testes E2E.');
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Página pública que carrega Clerk.
  await page.goto('/');

  // Login server-side oficial do Clerk.
  // Não usa senha e ignora verification/client trust/MFA.
  await clerk.signIn({
    page,
    emailAddress: email,
  });

  // Confirma que a sessão realmente permite acessar área protegida e que o Dashboard
  // inicializa sem exibir erro transitório de sessão durante a hidratação do Clerk.
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/dashboard/, {
    timeout: 30_000,
  });

  await expect(
    page.getByText('Sessão não autenticada no provedor de identidade.'),
  ).not.toBeVisible();

  await page.context().storageState({
    path: authFile,
  });
});
