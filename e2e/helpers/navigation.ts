import type { Page } from '@playwright/test'

export async function navigateToVault(page: Page, vaultAddress: string) {
  await page.goto(`/vaults/${vaultAddress}`)

  // Wait for page to load
  await page.waitForLoadState('networkidle')

  // Wait for widget to be visible
  await page.waitForSelector('[data-testid="widget"]', { timeout: 10000 })
}

export async function switchToWithdrawTab(page: Page) {
  // Click the Withdraw tab
  await page.click('button:has-text("Withdraw")')

  // Wait for tab switch
  await page.waitForTimeout(300)
}
