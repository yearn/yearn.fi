import { expect, test } from '../fixtures/synpress'
import { TEST_VAULT } from '../fixtures/test-vault'
import { ensureDepositTab, navigateToVault } from '../helpers/navigation'
import { checkBalance, logBalances } from '../helpers/wallet'
import { adjustGasSettings, ensureWalletConnected, handleChainSwitch } from '../helpers/wallet-connection'
import {
  checkForTxButtonError,
  clickPercentageButton,
  waitForBalanceLoaded,
  waitForDepositApproval
} from '../helpers/widget-interactions'

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
    // 1. Connect wallet first
    await page.goto('/v3')
    await ensureWalletConnected(page, metamask)

    // 2. Check wallet has sufficient balance
    await checkBalance({ minMatic: 0.1, minUSDC: 1 })

    // 3. Navigate to vault page
    await navigateToVault(page, TEST_VAULT.vaultAddress, 137)

    // 4. Ensure we're on Deposit tab and get the deposit widget
    const depositWidget = await ensureDepositTab(page)

    // 5. Wait for balance to load before clicking percentage button
    await waitForBalanceLoaded(depositWidget)

    // 6. Click 25% button
    await clickPercentageButton(depositWidget, 25)

    // 7. Verify input populated
    const input = depositWidget.locator('input[placeholder="0.00"]')
    await expect(input).not.toHaveValue('0')
    await expect(input).not.toHaveValue('')

    // 8. Click Approve button
    const approveButton = depositWidget.locator('[data-testid="approve-button"]')
    await expect(approveButton).toBeVisible()
    await approveButton.click()

    // 9. Handle potential chain switch and confirm approval in Metamask
    await handleChainSwitch(metamask, page)

    // Confirm transaction twice to handle spending cap approval
    await metamask.confirmTransaction() // This clicks "Next" in spending cap approval
    await page.waitForTimeout(3000) // Wait for the Approve screen to load
    await adjustGasSettings(page)
    await metamask.confirmTransaction()

    // 10. Wait for approval confirmation (Deposit button becomes enabled)
    await waitForDepositApproval(depositWidget)

    // 11. Click Deposit button
    const depositButton = depositWidget.locator('[data-testid="deposit-button"]')
    console.log(depositButton)
    console.log('Deposit button found')
    await depositButton.click()
    console.log('Deposit button clicked')

    await metamask.confirmTransaction()
    await expect(input).toHaveValue('', { timeout: 90000 })

    await checkForTxButtonError(depositWidget)
  })

  //   test('should zap DAI into USDC vault via Enso', async ({ page, metamask }) => {
  //     // 1. Connect wallet first
  //     await page.goto('/v3')
  //     await ensureWalletConnected(page, metamask)

  //     // 2. Check wallet has DAI balance
  //     await checkBalance({ minMatic: 0.1, minDAI: 1 })

  //     // 3. Navigate to vault page
  //     await navigateToVault(page, TEST_VAULT.vaultAddress, 137)

  //     // 4. Ensure we're on Deposit tab and get the deposit widget
  //     const depositWidget = await ensureDepositTab(page)

  //     // 5. Wait for balance to load (ensures widget is fully initialized)
  //     await waitForBalanceLoaded(depositWidget)

  //     // 6. Select DAI token
  //     await selectToken(depositWidget, TEST_VAULT.zapToken)

  //     // 7. Fill amount (0.5 DAI)
  //     const input = depositWidget.locator('input[placeholder="0.00"]')
  //     await input.fill('0.5')

  //     // 8. Wait for Enso route calculation
  //     await waitForRouteCalculation(depositWidget)

  //     // 9. Approve DAI
  //     const approveButton = depositWidget.locator('[data-testid="approve-button"]')
  //     await approveButton.click()
  //     await handleChainSwitch(metamask, page)
  //     await confirmTransactionWithRetry(metamask, page, true) // Enable gas adjustment

  //     // 10. Wait for approval confirmation
  //     await waitForDepositApproval(depositWidget)

  //     // Check for transaction errors
  //     await checkForTxButtonError(depositWidget)

  //     // 11. Deposit via Enso
  //     const depositButton = depositWidget.locator('[data-testid="deposit-button"]')
  //     await depositButton.click()
  //     await handleChainSwitch(metamask, page)
  //     await confirmTransactionWithRetry(metamask, page, true) // Enable gas adjustment

  //     // 12. Verify success - input should be cleared
  //     await expect(input).toHaveValue('', { timeout: 90000 })

  //     // Check for transaction errors
  //     await checkForTxButtonError(depositWidget)
  //   })
})
