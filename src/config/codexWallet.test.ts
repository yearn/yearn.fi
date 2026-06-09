import type { Chain } from 'viem'
import { describe, expect, it } from 'vitest'
import { getConnectorChain } from './codexWallet'

const ethereum = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://ethereum.example'] }
  }
} as Chain

describe('getConnectorChain', () => {
  it('returns configured chains by id', () => {
    expect(getConnectorChain([ethereum], 1)).toBe(ethereum)
  })

  it('rejects unsupported chain ids instead of falling back to the default chain', () => {
    expect(() => getConnectorChain([ethereum], 999)).toThrow(/Codex wallet chain 999 is not configured/)

    try {
      getConnectorChain([ethereum], 999)
    } catch (error) {
      expect((error as { code?: number }).code).toBe(4902)
    }
  })
})
