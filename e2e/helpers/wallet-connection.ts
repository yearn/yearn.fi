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

/**
 * Handle potential chain switch approval in MetaMask
 * Call this after clicking buttons that might trigger a chain switch (Approve, Deposit, Withdraw)
 * Handles:
 * 1. Adding a new network (if chain not yet added to MetaMask) - "Allow this site to add a network?"
 * 2. Switching to the network - "Allow this site to switch the network?"
 * Note: Both modals can appear in sequence if adding a new chain
 */
export async function handleChainSwitch(metamask: MetaMask, page: Page) {
  try {
    console.log('Checking for chain switch/add network dialog...')
    await page.waitForTimeout(500)

    // Step 1: Check for "Add network" approval dialog
    try {
      await metamask.approveSwitchNetwork()
      console.log('Network add approved')
      await page.waitForTimeout(1000)
    } catch (error) {
      console.log('No add network dialog')
    }

    // Step 2: Check for "Switch network" approval dialog
    try {
      await metamask.approveSwitchNetwork()
      console.log('Network switch approved')
      await page.waitForTimeout(1000)
    } catch (error) {
      console.log('No switch network dialog')
    }
  } catch (error) {
    console.log('Error handling chain switch:', error)
  }
}

/**
 * Adjust gas settings in MetaMask to ensure transaction has enough gas
 * Opens advanced gas settings and increases gas limit by adding "5" at the end
 */
export async function adjustGasSettings(page: Page) {
  try {
    console.log('Adjusting gas settings...')

    // Get MetaMask extension page
    const context = page.context()
    const pages = context.pages()

    // Log all pages
    console.log(`Total pages open: ${pages.length}`)
    for (let i = 0; i < pages.length; i++) {
      const title = await pages[i].title().catch(() => 'unknown')
      const url = pages[i].url()
      console.log(`Page ${i}: ${title} - ${url}`)
    }

    // Find the MetaMask notification page (not the home page)
    let metamaskPage = null
    for (const p of pages) {
      const url = p.url()
      // Look for notification.html which has the transaction confirmation
      if (url.includes('extension') && url.includes('notification.html')) {
        metamaskPage = p
        console.log('Found MetaMask notification page by URL:', url)
        break
      }
    }

    // Fallback to any MetaMask page if notification not found
    if (!metamaskPage) {
      console.log('No notification page found, trying any MetaMask page...')
      for (const p of pages) {
        const title = await p.title().catch(() => '')
        if (title.includes('MetaMask')) {
          metamaskPage = p
          console.log('Using MetaMask page by title:', await p.url())
          break
        }
      }
    }

    if (!metamaskPage) {
      console.log('No MetaMask page found, skipping gas adjustment')
      return
    }

    console.log('Using MetaMask page:', await metamaskPage.title(), metamaskPage.url())

    // Step 1: Click edit gas fee icon
    console.log('Step 1: Looking for edit gas fee icon...')
    const editGasFeeIcon = metamaskPage.locator('[data-testid="edit-gas-fee-icon"]')

    // Wait for it to be attached to DOM
    await editGasFeeIcon.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {
      console.log('Edit gas fee icon not found in DOM')
      return null
    })

    // Check if visible
    const hasEditIcon = await editGasFeeIcon.isVisible().catch(() => false)
    console.log(`Edit gas fee icon visible: ${hasEditIcon}`)

    if (!hasEditIcon) {
      console.log('Edit gas fee icon not visible, skipping gas adjustment')
      return
    }

    // Scroll into view
    await editGasFeeIcon.scrollIntoViewIfNeeded().catch(() => {
      console.log('Could not scroll edit icon into view')
    })
    await page.waitForTimeout(300)

    console.log('Clicking edit gas fee icon...')
    await editGasFeeIcon.click({ timeout: 5000 })
    console.log('Edit gas fee icon clicked')
    await page.waitForTimeout(1000)

    // Step 2: Click Advanced button (custom gas fee)
    console.log('Step 2: Looking for Advanced button...')
    const advancedButton = metamaskPage.locator('[data-testid="edit-gas-fee-item-custom"]')
    await advancedButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('Advanced button not visible')
      return null
    })

    const hasAdvanced = await advancedButton.isVisible().catch(() => false)
    console.log(`Advanced button visible: ${hasAdvanced}`)

    if (!hasAdvanced) {
      console.log('Advanced button not found, skipping')
      return
    }

    console.log('Clicking Advanced button...')
    await advancedButton.click({ timeout: 5000 })
    console.log('Advanced button clicked')
    await page.waitForTimeout(1000)

    // Step 3: Click Edit button
    console.log('Step 3: Looking for Edit button...')
    const editButton = metamaskPage.locator('[data-testid="advanced-gas-fee-edit"]')
    await editButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('Edit button not visible')
      return null
    })

    const hasEdit = await editButton.isVisible().catch(() => false)
    console.log(`Edit button visible: ${hasEdit}`)

    if (!hasEdit) {
      console.log('Edit button not found, skipping')
      return
    }

    console.log('Clicking Edit button...')
    await editButton.click({ timeout: 5000 })
    console.log('Edit button clicked')
    await page.waitForTimeout(1000)

    // Step 4: Edit gas limit input by adding "5" at the end
    console.log('Step 4: Looking for gas limit input...')
    const gasLimitInput = metamaskPage.locator('[data-testid="gas-limit-input"]')
    await gasLimitInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('Gas limit input not visible')
      return null
    })

    const hasGasLimit = await gasLimitInput.isVisible().catch(() => false)
    console.log(`Gas limit input visible: ${hasGasLimit}`)

    if (!hasGasLimit) {
      console.log('Gas limit input not found, skipping')
      return
    }

    // Get current value
    const currentValue = await gasLimitInput.inputValue()
    const newValue = currentValue + '5'

    console.log(`Adjusting gas limit: ${currentValue} -> ${newValue}`)

    // Clear and set new value
    await gasLimitInput.click() // Focus the input first
    await page.waitForTimeout(200)
    await gasLimitInput.clear()
    await page.waitForTimeout(200)
    await gasLimitInput.fill(newValue)
    await page.waitForTimeout(500)

    console.log('Gas limit adjusted successfully')

    // Click Save or confirm if needed
    const saveButton = metamaskPage.locator('button:has-text("Save")')
    const hasSave = await saveButton.isVisible({ timeout: 2000 }).catch(() => false)
    console.log(`Save button visible: ${hasSave}`)

    if (hasSave) {
      console.log('Clicking Save button...')
      await saveButton.click()
      await page.waitForTimeout(500)
      console.log('Save button clicked')
    }
  } catch (error) {
    console.log('Error adjusting gas settings:', error)
    // Don't throw - gas adjustment is optional
  }
}
