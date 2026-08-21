import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/features',
  timeout: 600000, // 10 min default test timeout
  expect: {
    timeout: 30000,
  },
  fullyParallel: false,
  workers: 1, // Single worker for API tests (rate limiting)
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/test-results.json' }],
    ['html', { outputFolder: 'reports/html-report' }],
    ['./src/reporting/PlaywrightDashboardReporter.ts'],
  ],
  use: {
    baseURL: process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  projects: [
    { name: 'asr-api-tests', testMatch: '**/*.spec.ts' },
  ],
});
