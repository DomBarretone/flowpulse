import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const authFile = path.resolve(__dirname, 'playwright/.auth/user.json');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w apps/api',
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ...process.env,

        // E2E deve usar exclusivamente o double determinístico local.
        // Nunca utilizar o OpenRouter real durante Playwright.
        OPENROUTER_BASE_URL: 'http://127.0.0.1:3002',
        OPENROUTER_API_KEY: 'e2e-local-test-key',
      },
    },
    {
      command: 'npm run dev -w apps/web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
