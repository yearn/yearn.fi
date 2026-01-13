import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 120000, // 2 minutes per test
  retries: 1, // Retry once on failure (network issues)

  use: {
    baseURL: 'http://localhost:3002',
    headless: false, // Metamask requires headed mode
    viewport: { width: 1280, height: 720 },
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium-metamask',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],

  webServer: {
    command: 'bun run dev --port 3002',
    port: 3002,
    reuseExistingServer: true,
    timeout: 120000
  }
})
