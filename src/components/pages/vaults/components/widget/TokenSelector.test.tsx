import type { TToken } from '@shared/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TokenSelector } from './TokenSelector'

const BASE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001' as const

const { mockUseWallet } = vi.hoisted(() => ({
  mockUseWallet: vi.fn()
}))

vi.mock('@shared/contexts/useWallet', () => ({
  useWallet: mockUseWallet
}))

function buildToken(overrides: Partial<TToken> = {}): TToken {
  return {
    address: BASE_TOKEN_ADDRESS,
    name: 'Base Token',
    symbol: 'BASE',
    decimals: 18,
    chainID: 1,
    value: 0,
    balance: {
      raw: 5n,
      normalized: 5,
      display: '5',
      decimals: 18
    },
    ...overrides
  }
}

describe('TokenSelector', () => {
  it('lets extra tokens override selector metadata and logo sources for matching addresses', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken()
        }
      },
      getToken: () => buildToken()
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        extraTokens={[
          buildToken({
            name: 'Override Token',
            symbol: 'OVR',
            logoURI: 'https://example.com/override.png'
          })
        ]}
      />
    )

    expect(html).toContain('Override Token')
    expect(html).toContain('OVR')
    expect(html).toContain('https://example.com/override.png')
    expect(html).not.toContain('Base Token')
  })
})
