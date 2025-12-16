import { expect, test } from '../fixtures/synpress'
import { TEST_VAULT } from '../fixtures/test-vault'
import { ensureWithdrawTab, navigateToVault } from '../helpers/navigation'
import { checkBalance, logBalances } from '../helpers/wallet'
import { ensureWalletConnected } from '../helpers/wallet-connection'
import {
  clickPercentageButton,
  selectToken,
  waitForBalanceLoaded,
  waitForRouteCalculation,
  waitForWithdrawApproval
} from '../helpers/widget-interactions'

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
    // 1. Connect wallet first
    await page.goto('/v3')
    await ensureWalletConnected(page, metamask)

    // 2. Check wallet has MATIC for gas
    await checkBalance({ minMatic: 0.1 })

    // 3. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress, 137)

    // 4. Ensure we're on Withdraw tab and get the withdraw widget
    const withdrawWidget = await ensureWithdrawTab(page)

    // 5. Wait for balance to load before clicking percentage button
    await waitForBalanceLoaded(withdrawWidget)

    // 6. Click 25% button
    await clickPercentageButton(withdrawWidget, 25)

    // 7. Verify input populated
    const input = withdrawWidget.locator('input[placeholder="0.00"]')
    await expect(input).not.toHaveValue('0')
    await expect(input).not.toHaveValue('')

    // 8. Click Withdraw button (no approve needed for vault shares)
    const withdrawButton = withdrawWidget.locator('button:has-text("Withdraw")')
    await expect(withdrawButton).toBeVisible()
    await expect(withdrawButton).not.toBeDisabled()
    await withdrawButton.click()

    // 9. Confirm withdraw in Metamask
    await metamask.confirmTransaction()

    // 10. Wait for success - input should be cleared
    await expect(input).toHaveValue('', { timeout: 90000 })
  })

  test('should zap vault shares to DAI via Enso', async ({ page, metamask }) => {
    // 1. Connect wallet first
    await page.goto('/v3')
    await ensureWalletConnected(page, metamask)

    // 2. Check wallet has MATIC for gas
    await checkBalance({ minMatic: 0.1 })

    // 3. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress, 137)

    // 4. Ensure we're on Withdraw tab and get the withdraw widget
    const withdrawWidget = await ensureWithdrawTab(page)

    // 5. Wait for balance to load (ensures widget is fully initialized)
    await waitForBalanceLoaded(withdrawWidget)

    // 6. Select DAI token
    await selectToken(withdrawWidget, TEST_VAULT.zapToken)

    // 7. Fill amount (5 vault shares)
    const input = withdrawWidget.locator('input[placeholder="0.00"]')
    await input.fill('5')

    // 8. Wait for Enso route calculation
    await waitForRouteCalculation(withdrawWidget)

    // 9. Approve vault shares
    const approveButton = withdrawWidget.locator('button:has-text("Approve")')
    await approveButton.click()
    await metamask.confirmTransaction()

    // 10. Wait for approval confirmation
    await waitForWithdrawApproval(withdrawWidget)

    // 11. Withdraw via Enso
    const withdrawButton = withdrawWidget.locator('button:has-text("Withdraw")')
    await withdrawButton.click()
    await metamask.confirmTransaction()

    // 12. Verify success - input should be cleared
    await expect(input).toHaveValue('', { timeout: 90000 })
  })
})
