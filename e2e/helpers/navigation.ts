import type { Locator, Page } from '@playwright/test'

/**
 * Get the visible widget container (inside <section>)
 */
function getWidget(page: Page): Locator {
  return page.locator('section').getByTestId('widget')
}

/**
 * Navigate to vault page and wait for widget to load
 */
export async function navigateToVault(page: Page, vaultAddress: string, chainId: number) {
  await page.goto(`/vaults/${chainId}/${vaultAddress}`)
  await page.waitForLoadState('networkidle')

  // Wait for the widget to be visible
  const widget = getWidget(page)
  await widget.waitFor({ state: 'visible', timeout: 30000 })
}

/**
 * Ensure we're on the Deposit tab and return the scoped widget
 */
export async function ensureDepositTab(page: Page): Promise<Locator> {
  const widget = getWidget(page)

  // Target the tab button specifically (not the action button)
  // Tab buttons have specific styling classes and are part of the tab navigation
  const depositTab = widget.locator('button.flex-1:has-text("Deposit")').first()

  // Check if Deposit tab exists and click if not already active
  await depositTab.waitFor({ state: 'visible', timeout: 5000 })
  await depositTab.click()
  await page.waitForTimeout(300)

  return widget
}

/**
 * Switch to Withdraw tab and return the scoped widget
 */
export async function ensureWithdrawTab(page: Page): Promise<Locator> {
  const widget = getWidget(page)

  // Target the tab button specifically (not the action button)
  const withdrawTab = widget.locator('button.flex-1:has-text("Withdraw")').first()

  await withdrawTab.waitFor({ state: 'visible', timeout: 5000 })
  await withdrawTab.click()
  await page.waitForTimeout(300)

  return widget
}
