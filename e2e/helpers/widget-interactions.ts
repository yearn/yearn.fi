import type { Page } from '@playwright/test'

export async function fillDepositAmount(page: Page, amount: string) {
  await page.fill('input[placeholder="0.00"]', amount)
  // Wait for debounce to settle
  await page.waitForTimeout(500)
}

export async function clickPercentageButton(
  page: Page,
  percent: 25 | 50 | 75 | 100
) {
  const buttonText = percent === 100 ? 'Max' : `${percent}%`
  await page.click(`button:has-text("${buttonText}")`)
  // Wait for input to update
  await page.waitForTimeout(300)
}

export async function selectToken(page: Page, tokenAddress: string) {
  // Open token selector
  await page.click('[data-token-selector-button]')

  // Wait for selector to open
  await page.waitForTimeout(500)

  // Select token
  await page.click(`[data-token="${tokenAddress.toLowerCase()}"]`)

  // Wait for selector to close
  await page.waitForTimeout(500)
}

export async function waitForRouteCalculation(page: Page) {
  // Wait for "Finding route..." to disappear
  await page.waitForSelector(
    'button:not(:has-text("Finding route..."))',
    { timeout: 30000 }
  )
}

export async function waitForApprovalConfirmation(page: Page) {
  // Wait for Deposit button to become enabled
  await page.waitForSelector(
    'button:has-text("Deposit"):not(:disabled)',
    { timeout: 60000 }
  )
}

export async function waitForWithdrawApprovalConfirmation(page: Page) {
  // Wait for Withdraw button to become enabled
  await page.waitForSelector(
    'button:has-text("Withdraw"):not(:disabled)',
    { timeout: 60000 }
  )
}
