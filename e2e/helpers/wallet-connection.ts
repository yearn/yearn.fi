import type { Page } from '@playwright/test'
import type { MetaMask } from '@synthetixio/synpress/playwright'

/**
 * Ensures the wallet is connected. If already connected, does nothing.
 * If not connected, connects the wallet through RainbowKit.
 */
export async function ensureWalletConnected(page: Page, metamask: MetaMask) {
  // Check the connect wallet button state
  const connectButton = page.locator('[data-testid="connect-wallet-button"]')
  await connectButton.waitFor({ state: 'visible', timeout: 10000 })

  const buttonText = await connectButton.textContent()

  // If button shows truncated address (0x0046...2BA6), wallet is already connected
  if (buttonText?.match(/^0x[0-9a-fA-F]{4}(\.\.\.|…)[0-9a-fA-F]{4}$/)) {
    console.log('Wallet already connected:', buttonText)
    return
  }

  console.log('Wallet not connected, connecting now...')

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle')

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

  // Verify wallet is connected by checking button text changed
  await page.waitForFunction(
    (selector) => {
      const button = document.querySelector(selector)
      const text = button?.textContent || ''
      return text.match(/^0x[0-9a-fA-F]{4}(\.\.\.|…)[0-9a-fA-F]{4}$/)
    },
    '[data-testid="connect-wallet-button"]',
    { timeout: 10000 }
  )

  console.log('Wallet connected successfully')
}
