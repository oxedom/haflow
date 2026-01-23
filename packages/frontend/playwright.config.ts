import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV } from './tests/e2e-env';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  timeout: 30000,
  globalSetup: './tests/globalSetup.ts',
  globalTeardown: './tests/globalTeardown.ts',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Run Firefox and WebKit only in CI for faster local development
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],

  webServer: [
    {
      command: 'pnpm --filter @haloop/backend dev',
      url: 'http://localhost:4000/api/missions',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: E2E_ENV,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter frontend dev',
      url: 'http://localhost:5173',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
