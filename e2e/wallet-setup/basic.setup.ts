import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'
import * as dotenv from 'dotenv'

// Load .env.e2e
dotenv.config({ path: '.env.e2e' })

const PASSWORD = 'Tester@1234'
const SEED_PHRASE = process.env.E2E_SEED_PHRASE
if (!SEED_PHRASE) {
  throw new Error(
    'E2E_SEED_PHRASE environment variable not set. Please create .env.e2e file with test wallet seed phrase.'
  )
}

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD)
  await metamask.importWallet(SEED_PHRASE)
})
