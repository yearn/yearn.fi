import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('keeps every supported network and the Robinhood RPC override without a WalletConnect project', async () => {
  vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', '')
  vi.stubEnv('NEXT_PUBLIC_RPC_ROBINHOOD', 'https://rpc.robinhood.example')
  const { wagmiConfig } = await import('@erc4626/lib/wagmiConfig')
  expect(wagmiConfig.chains.map(({ id }) => id)).toEqual(SUPPORTED_CHAINS.map(({ id }) => id))
  expect(wagmiConfig.connectors.map(({ id }) => id)).toEqual(['injected', 'safe'])
  const client = wagmiConfig.getClient({ chainId: 4663 })
  expect(client.transport.url).toBe('https://rpc.robinhood.example')
})
