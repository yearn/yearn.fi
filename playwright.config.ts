import { defineConfig, devices } from '@playwright/test'

const DEFAULT_PORT = 3000
const DEFAULT_HOST = '127.0.0.1'
const port = Number(process.env.PORT || DEFAULT_PORT)
const host = process.env.HOST || DEFAULT_HOST
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `HOST=${host} PORT=${port} bun run dev`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
