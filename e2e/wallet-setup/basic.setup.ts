import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'
import * as dotenv from 'dotenv'

// Load .env.e2e
dotenv.config({ path: '.env.e2e' })

const PASSWORD = 'Tester@1234'
const SEED_PHRASE = process.env.SEED_PHRASE || 'test test test test test test test test test test test junk'

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD)
  await metamask.importWallet(SEED_PHRASE)
})
