// Import necessary Synpress modules and setup
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../wallet-setup/basic.setup'

// Helper function to truncate hex addresses
function truncateHex(address: string, length: number = 4): string {
  if (!address) return ''
  return `${address.slice(0, length + 2)}…${address.slice(-length)}`
}

// Create a test instance with Synpress and MetaMask fixtures
const test = testWithSynpress(metaMaskFixtures(basicSetup))

// Extract expect function from test
const { expect } = test
const EXPECTED_ADDRESS = process.env.E2E_ADDRESS

// Define a basic test case
test('should connect wallet to the MetaMask Test Dapp', async ({ page, context, metamaskPage, extensionId }) => {
  // Create a new MetaMask instance
  const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

  // Navigate to the list
  await page.goto('/v3')

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle')

  // Wait for connect button to be visible and clickable
  const connectButton = page.locator('[data-testid="connect-wallet-button"]')
  await connectButton.waitFor({ state: 'visible', timeout: 10000 })

  // Scroll into view if needed
  await connectButton.scrollIntoViewIfNeeded()

  // Force click to bypass DevToolbar or other overlays
  await connectButton.click({ force: true, timeout: 10000 })

  // Wait for RainbowKit wallet selector modal to appear
  await page.waitForSelector('[data-testid="rk-wallet-option-io.metamask"]', { timeout: 10000 })

  // Click the MetaMask option in RainbowKit modal
  await page.locator('[data-testid="rk-wallet-option-io.metamask"]').click()

  // Connect MetaMask to the dapp (handles the MetaMask popup)
  await metamask.connectToDapp()

  // Verify the connected account address is displayed
  const buttonText = await page.locator('[data-testid="connect-wallet-button"]').textContent()

  if (EXPECTED_ADDRESS) {
    // If expected address is provided, verify it matches
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toHaveText(truncateHex(EXPECTED_ADDRESS, 4))
  } else {
    // Otherwise, just verify the button shows a truncated address format
    // Format: 0x0046...2BA6 (with three dots or ellipsis)
    expect(buttonText).toMatch(/^0x[0-9a-fA-F]{4}(\.\.\.|\…)[0-9a-fA-F]{4}$/)
  }
})
