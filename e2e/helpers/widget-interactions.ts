import type { Locator } from '@playwright/test'

/**
 * Wait for the balance to be loaded and displayed (non-zero)
 * This ensures percentage buttons will work correctly
 */
export async function waitForBalanceLoaded(widget: Locator) {
  // Wait for the balance text to show a non-zero value
  // Balance is typically shown as "Balance: X USDC" or similar
  await widget.locator('text=/Balance:\\s*[^0\\s].*[A-Z]{3,}/i').waitFor({
    state: 'visible',
    timeout: 15000
  })

  // Add small delay to ensure state is fully updated
  await widget.page().waitForTimeout(500)
}

/**
 * Fill amount in the input field within a specific tab widget
 */
export async function fillAmount(widget: Locator, amount: string) {
  await widget.locator('input[placeholder="0.00"]').fill(amount)
  // Wait for debounce to settle
  await widget.page().waitForTimeout(500)
}

/**
 * Click a percentage button (25%, 50%, 75%, Max) within a specific tab widget
 */
export async function clickPercentageButton(widget: Locator, percent: 25 | 50 | 75 | 100) {
  const buttonText = percent === 100 ? 'Max' : `${percent}%`
  await widget.locator(`button:has-text("${buttonText}")`).click()

  // Wait for input to update
  await widget.page().waitForTimeout(300)
}

/**
 * Select a token from the token selector within a specific tab widget
 */
export async function selectToken(widget: Locator, tokenAddress: string) {
  const page = widget.page()

  // Open token selector
  await widget.locator('[data-token-selector-button]').click()
  await page.waitForTimeout(500)

  // Select token (modal is outside widget scope)
  await page.click(`[data-token="${tokenAddress.toLowerCase()}"]`)
  await page.waitForTimeout(500)
}

/**
 * Wait for Enso route calculation to complete (for zap deposits)
 * Waits for the Approve button to appear (not "Approve First" and not "Finding route...")
 */
export async function waitForRouteCalculation(widget: Locator) {
  // Wait for any approve button that's not disabled and doesn't say "Finding route..."
  await widget
    .locator('button:has-text("Approve"):not(:disabled):not(:has-text("Finding route..."))')
    .first()
    .waitFor({ timeout: 30000 })
}

/**
 * Wait for deposit approval confirmation (Deposit button becomes enabled)
 */
export async function waitForDepositApproval(widget: Locator) {
  await widget.locator('[data-testid="deposit-button"]:not(:disabled)').waitFor({ timeout: 600000 })
}

/**
 * Wait for withdraw approval confirmation (Withdraw button becomes enabled)
 */
export async function waitForWithdrawApproval(widget: Locator) {
  await widget.locator('[data-testid="withdraw-button"]:not(:disabled)').waitFor({ timeout: 60000 })
}

/**
 * Check if the TxButton is showing an error state
 * If error is detected, throw an error to fail the test
 */
export async function checkForTxButtonError(widget: Locator) {
  const tryAgainButton = widget.locator('button:has-text("Try Again")')
  const hasError = await tryAgainButton.isVisible({ timeout: 1000 }).catch(() => false)

  if (hasError) {
    throw new Error('Transaction failed - TxButton is showing "Try Again" error state')
  }
}
