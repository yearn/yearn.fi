import { expect, test } from '../fixtures/synpress'
import { TEST_VAULT } from '../fixtures/test-vault'
import { navigateToVault } from '../helpers/navigation'
import { checkBalance, logBalances } from '../helpers/wallet'
import { clickPercentageButton } from '../helpers/widget-interactions'

test.describe('Widget Deposit', () => {
  test.beforeAll(async () => {
    // Log balances before tests
    await logBalances()
  })

  test.afterAll(async () => {
    // Log balances after tests
    await logBalances()
  })

  test('should deposit USDC into vault (vanilla)', async ({ page, metamask }) => {
    // 1. Check wallet has sufficient balance
    await checkBalance({ minMatic: 0.1, minUSDC: 10 })

    // 2. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress)

    // 3. Click 25% button
    await clickPercentageButton(page, 25)

    // 4. Verify input populated
    const input = page.locator('input[placeholder="0.00"]')
    await expect(input).not.toHaveValue('0')
    await expect(input).not.toHaveValue('')

    // 5. Click Approve button
    const approveButton = page.locator('button:has-text("Approve")')
    await expect(approveButton).toBeVisible()
    await approveButton.click()

    // 6. Confirm approval in Metamask
    await metamask.confirmTransaction()

    // 7. Wait for approval confirmation (Deposit button becomes enabled)
    await page.waitForSelector('button:has-text("Deposit"):not(:disabled)', {
      timeout: 60000
    })

    // 8. Click Deposit button
    const depositButton = page.locator('button:has-text("Deposit")')
    await depositButton.click()

    // 9. Confirm deposit in Metamask
    await metamask.confirmTransaction()

    // 10. Wait for success - input should be cleared
    await expect(input).toHaveValue('', { timeout: 90000 })
  })

  test('should zap DAI into USDC vault via Enso', async ({ page, metamask }) => {
    // 1. Check wallet has DAI balance
    await checkBalance({ minMatic: 0.1, minDAI: 10 })

    // 2. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress)

    // 3. Open token selector
    await page.click('[data-token-selector-button]')

    // 4. Wait for selector to open
    await page.waitForTimeout(500)

    // 5. Select DAI from token list
    await page.click(`[data-token="${TEST_VAULT.zapToken.toLowerCase()}"]`)

    // 6. Wait for selector to close and UI to update
    await page.waitForTimeout(500)

    // 7. Fill amount
    await page.fill('input[placeholder="0.00"]', '5')

    // 8. Wait for Enso route calculation
    await page.waitForSelector('button:not(:has-text("Finding route...")):has-text("Approve")', { timeout: 30000 })

    // 9. Approve DAI
    const approveButton = page.locator('button:has-text("Approve")')
    await approveButton.click()
    await metamask.confirmTransaction()

    // 10. Wait for approval confirmation
    await page.waitForSelector('button:has-text("Deposit"):not(:disabled)', {
      timeout: 60000
    })

    // 11. Deposit via Enso
    const depositButton = page.locator('button:has-text("Deposit")')
    await depositButton.click()
    await metamask.confirmTransaction()

    // 12. Verify success - input should be cleared
    const input = page.locator('input[placeholder="0.00"]')
    await expect(input).toHaveValue('', { timeout: 90000 })
  })
})
