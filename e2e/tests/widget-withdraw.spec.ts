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
})
