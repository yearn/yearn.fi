import { test, expect } from '../fixtures/synpress'
import { TEST_VAULT } from '../fixtures/test-vault'
import { checkBalance, logBalances } from '../helpers/wallet'
import { navigateToVault, switchToWithdrawTab } from '../helpers/navigation'
import { clickPercentageButton } from '../helpers/widget-interactions'

test.describe('Widget Withdraw', () => {
  test.beforeAll(async () => {
    // Log balances before tests
    await logBalances()
  })

  test.afterAll(async () => {
    // Log balances after tests
    await logBalances()
  })

  test('should withdraw USDC from vault (vanilla)', async ({ page, metamask }) => {
    // 1. Check wallet has MATIC for gas
    await checkBalance({ minMatic: 0.1 })

    // 2. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress)

    // 3. Switch to Withdraw tab
    await switchToWithdrawTab(page)

    // 4. Click 25% button
    await clickPercentageButton(page, 25)

    // 5. Verify input populated
    const input = page.locator('input[placeholder="0.00"]')
    await expect(input).not.toHaveValue('0')
    await expect(input).not.toHaveValue('')

    // 6. Click Withdraw button (no approve needed for vault shares)
    const withdrawButton = page.locator('button:has-text("Withdraw")')
    await expect(withdrawButton).toBeVisible()
    await expect(withdrawButton).not.toBeDisabled()
    await withdrawButton.click()

    // 7. Confirm withdraw in Metamask
    await metamask.confirmTransaction()

    // 8. Wait for success - input should be cleared
    await expect(input).toHaveValue('', { timeout: 90000 })
  })

  test('should zap vault shares to DAI via Enso', async ({ page, metamask }) => {
    // 1. Check wallet has MATIC for gas
    await checkBalance({ minMatic: 0.1 })

    // 2. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress)

    // 3. Switch to Withdraw tab
    await switchToWithdrawTab(page)

    // 4. Open token selector
    await page.click('[data-token-selector-button]')

    // 5. Wait for selector to open
    await page.waitForTimeout(500)

    // 6. Select DAI from token list
    await page.click(`[data-token="${TEST_VAULT.zapToken.toLowerCase()}"]`)

    // 7. Wait for selector to close and UI to update
    await page.waitForTimeout(500)

    // 8. Fill amount
    await page.fill('input[placeholder="0.00"]', '5')

    // 9. Wait for Enso route calculation
    await page.waitForSelector(
      'button:not(:has-text("Finding route...")):has-text("Approve")',
      { timeout: 30000 }
    )

    // 10. Approve vault shares
    const approveButton = page.locator('button:has-text("Approve")')
    await approveButton.click()
    await metamask.confirmTransaction()

    // 11. Wait for approval confirmation
    await page.waitForSelector('button:has-text("Withdraw"):not(:disabled)', {
      timeout: 60000
    })

    // 12. Withdraw via Enso
    const withdrawButton = page.locator('button:has-text("Withdraw")')
    await withdrawButton.click()
    await metamask.confirmTransaction()

    // 13. Verify success - input should be cleared
    const input = page.locator('input[placeholder="0.00"]')
    await expect(input).toHaveValue('', { timeout: 90000 })
  })
})
