import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { getYearnWallets } from '@yearn/wallet-ui/rainbowkit'
import { expect, it, vi } from 'vitest'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

// Keep RainbowKit's real wallet factories and transport cache; replace only the network transport.
vi.mock('wagmi/connectors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi/connectors')>()),
  walletConnect: () => {
    const provider = {}
    return () => ({
      id: 'walletConnect',
      name: 'WalletConnect',
      type: 'walletConnect',
      getProvider: async () => provider
    })
  }
}))

it('shares one WalletConnect provider across the QR choice and all curated wallets', async () => {
  const config = createConfig({
    chains: [mainnet],
    transports: { [mainnet.id]: http() },
    connectors: connectorsForWallets(getYearnWallets(), { projectId: 'test', appName: 'Yearn' }),
    storage: null
  })
  const transports = config.connectors.filter(({ type }) => type === 'walletConnect')
  expect(transports).toHaveLength(12)
  const providers = await Promise.all(transports.map((connector) => connector.getProvider()))
  expect(new Set(providers).size).toBe(1)
})
