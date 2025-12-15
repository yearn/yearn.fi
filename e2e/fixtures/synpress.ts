import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../wallet-setup/basic.setup'

// Create the base test with MetaMask fixtures
const baseTest = testWithSynpress(metaMaskFixtures(basicSetup))

// Extend with a convenient metamask helper
export const test = baseTest.extend<{ metamask: MetaMask }>({
  metamask: async ({ context, metamaskPage, extensionId }, use) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId)
    await use(metamask)
  }
})

export { expect } from '@playwright/test'
