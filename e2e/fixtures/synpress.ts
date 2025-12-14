import { expect } from '@playwright/test'
import { defineWalletSetup } from '@synthetixio/synpress'
import { metaMaskFixtures } from '@synthetixio/synpress/playwright'
import * as dotenv from 'dotenv'

// Load .env.e2e
dotenv.config({ path: '.env.e2e' })

const privateKey = process.env.E2E_PRIVATE_KEY
if (!privateKey) {
  throw new Error(
    'E2E_PRIVATE_KEY environment variable not set. ' +
    'Please create .env.e2e file with test wallet private key.'
  )
}

if (privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
  throw new Error(
    'Please replace E2E_PRIVATE_KEY in .env.e2e with actual test wallet private key'
  )
}

// Define wallet setup using private key
const walletSetup = defineWalletSetup('Test123!', async (context, walletPage) => {
  const metamask = new (await import('@synthetixio/synpress/playwright')).MetaMask(
    context,
    walletPage,
    'Test123!'
  )

  await metamask.importWalletFromPrivateKey(privateKey)
})

// Create test with MetaMask fixtures
export const test = metaMaskFixtures(walletSetup)

export { expect }
