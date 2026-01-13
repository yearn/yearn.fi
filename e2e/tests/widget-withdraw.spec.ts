import { test } from '../fixtures/synpress'
// import { TEST_VAULT } from '../fixtures/test-vault'
// import { ensureWithdrawTab, navigateToVault } from '../helpers/navigation'
import { logBalances } from '../helpers/wallet'

// import { ensureWalletConnected, handleChainSwitch } from '../helpers/wallet-connection'
// import {
//   checkForTxButtonError,
//   clickPercentageButton,
//   selectToken,
//   waitForBalanceLoaded,
//   waitForRouteCalculation,
//   waitForWithdrawApproval
// } from '../helpers/widget-interactions'

test.describe('Widget Withdraw', () => {
  test.beforeAll(async () => {
    // Log balances before tests
    await logBalances()
  })

  test.afterAll(async () => {
    // Log balances after tests
    await logBalances()
  })

  // test('should withdraw USDC from vault (vanilla)', async ({ page, metamask }) => {
  //   // Capture browser console logs
  //   page.on('console', (msg) => {
  //     const type = msg.type()
  //     if (
  //       type === 'error' ||
  //       type === 'warning' ||
  //       msg.text().includes('Gas overrides') ||
  //       msg.text().includes('Transaction failed')
  //     ) {
  //       console.log(`[BROWSER ${type.toUpperCase()}]:`, msg.text())
  //     }
  //   })

  //   // 1. Connect wallet first
  //   await page.goto('/v3')
  //   await ensureWalletConnected(page, metamask)

  //   // 2. Check wallet has MATIC for gas
  //   await checkBalance({ minMatic: 0.1 })

  //   // 3. Navigate to vault page
  //   await navigateToVault(page, TEST_VAULT.vaultAddress, 137)

  //   // 4. Ensure we're on Withdraw tab and get the withdraw widget
  //   const withdrawWidget = await ensureWithdrawTab(page)

  //   // 5. Wait for balance to load before clicking percentage button
  //   await waitForBalanceLoaded(withdrawWidget)

  //   // 6. Click 25% button
  //   await clickPercentageButton(withdrawWidget, 25)

  //   // 7. Verify input populated
  //   const input = withdrawWidget.locator('input[placeholder="0.00"]')
  //   await expect(input).not.toHaveValue('0')
  //   await expect(input).not.toHaveValue('')

  //   // 8. Click Withdraw button (no approve needed for vault shares)
  //   const withdrawButton = withdrawWidget.locator('[data-testid="withdraw-button"]')
  //   await expect(withdrawButton).toBeVisible()
  //   await withdrawButton.click()

  //   // 9. Handle potential chain switch and confirm withdraw in Metamask
  //   await handleChainSwitch(metamask, page)
  //   await confirmTransactionWithRetry(metamask, page, true) // Enable gas adjustment

  //   // 10. Wait for success - input should be cleared
  //   await expect(input).toHaveValue('', { timeout: 90000 })

  //   // Check for transaction errors
  //   await checkForTxButtonError(withdrawWidget)
  // })

  // test('should zap vault shares to DAI via Enso', async ({ page, metamask }) => {
  //   // Capture browser console logs
  //   page.on('console', (msg) => {
  //     const type = msg.type()
  //     if (
  //       type === 'error' ||
  //       type === 'warning' ||
  //       msg.text().includes('Gas overrides') ||
  //       msg.text().includes('Transaction failed')
  //     ) {
  //       console.log(`[BROWSER ${type.toUpperCase()}]:`, msg.text())
  //     }
  //   })

  //   // 1. Connect wallet first
  //   await page.goto('/v3')
  //   await ensureWalletConnected(page, metamask)

  //   // 2. Check wallet has MATIC for gas
  //   await checkBalance({ minMatic: 0.1 })

  //   // 3. Navigate to vault page
  //   await navigateToVault(page, TEST_VAULT.vaultAddress, 137)

  //   // 4. Ensure we're on Withdraw tab and get the withdraw widget
  //   const withdrawWidget = await ensureWithdrawTab(page)

  //   // 5. Wait for balance to load (ensures widget is fully initialized)
  //   await waitForBalanceLoaded(withdrawWidget)

  //   // 6. Select DAI token
  //   await selectToken(withdrawWidget, TEST_VAULT.zapToken)

  //   // 7. Fill amount (5 vault shares)
  //   const input = withdrawWidget.locator('input[placeholder="0.00"]')
  //   await input.fill('5')

  //   // 8. Wait for Enso route calculation
  //   await waitForRouteCalculation(withdrawWidget)

  //   // 9. Approve vault shares
  //   const approveButton = withdrawWidget.locator('[data-testid="approve-button"]')
  //   await approveButton.click()
  //   await handleChainSwitch(metamask, page)
  //   await confirmTransactionWithRetry(metamask, page, true) // Enable gas adjustment

  //   // 10. Wait for approval confirmation
  //   await waitForWithdrawApproval(withdrawWidget)

  //   // Check for transaction errors
  //   await checkForTxButtonError(withdrawWidget)

  //   // 11. Withdraw via Enso
  //   const withdrawButton = withdrawWidget.locator('[data-testid="withdraw-button"]')
  //   await withdrawButton.click()
  //   await handleChainSwitch(metamask, page)
  //   await confirmTransactionWithRetry(metamask, page, true) // Enable gas adjustment

  //   // 12. Verify success - input should be cleared
  //   await expect(input).toHaveValue('', { timeout: 90000 })

  //   // Check for transaction errors
  //   await checkForTxButtonError(withdrawWidget)
  // })
})
