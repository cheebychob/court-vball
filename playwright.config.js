import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 }
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/*.webkit.spec.js',
      use: { browserName: 'chromium' }
    },
    {
      name: 'mobile-webkit',
      testMatch: '**/*.webkit.spec.js',
      use: { ...devices['iPhone 13'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
