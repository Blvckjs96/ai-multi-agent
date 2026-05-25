import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5001',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        },
      },
    },
  ],

  // Backend must be running separately; Vite dev server starts here.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      VITE_API_KEY: process.env.VITE_API_KEY || '',
      VITE_BACKEND_URL: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8001',
    },
  },
})
