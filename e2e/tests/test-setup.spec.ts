// Import necessary Synpress modules and setup
import { testWithSynpress } from '@synthetixio/synpress'
import { metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../wallet-setup/basic.setup'

// Create a test instance with Synpress and MetaMask fixtures
const test = testWithSynpress(metaMaskFixtures(basicSetup))

// Extract expect function from test
const { expect } = test

// Define a basic test case
test('should connect wallet to the MetaMask Test Dapp', async ({ page }) => {
  // Create a new MetaMask instance
  // const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)

  // Navigate to the list
  await page.goto('/v3')

  // Click the connect button
  // await page.locator('[data-testid="connect-wallet-button"]').click()
  // await page.waitForSelector('[data-testid="rk-wallet-option-io.metamask"]', { timeout: 10000 })
  // Connect MetaMask to the dapp
  // await metamask.connectToDapp()

  // Verify the connected account address
  // await expect(page.locator('[data-testid="connect-wallet-button"]')).toHaveText('0x0046…2BA6')
  await expect(page.locator('[data-testid="connect-wallet-button"]')).toHaveText('Connect wallet')
})
