import type { TToken } from '@shared/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TokenSelector } from './TokenSelector'

const BASE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const VAULT_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000002' as const
const STAKING_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000003' as const
const LEGACY_USDAF_ADDRESS = '0x85E30b8b263bC64d94b827ed450F2EdFEE8579dA' as const

const { mockUseWallet, mockUseYearn } = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseYearn: vi.fn()
}))

vi.mock('@shared/contexts/useWallet', () => ({
  useWallet: mockUseWallet
}))

vi.mock('@shared/contexts/WithTokenList', () => ({
  useTokenList: () => ({
    tokenLists: {}
  })
}))

vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: mockUseYearn
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
  mockUseYearn.mockReturnValue({
    allVaults: {},
    getPrice: () => ({ normalized: 0 })
  })

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

  it('hides the chain selector when only one allowed chain is provided', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        747474: {
          [BASE_TOKEN_ADDRESS]: buildToken({
            chainID: 747474,
            value: 100
          })
        }
      },
      getToken: () =>
        buildToken({
          chainID: 747474,
          value: 100
        })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={747474}
        allowedChainIds={[747474]}
      />
    )

    expect(html).not.toContain('alt="Katana"')
    expect(html).not.toContain('alt="Ethereum"')
    expect(html).not.toContain('alt="Optimism"')
  })

  it('renders custom header chain options when provided', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        747474: {
          [BASE_TOKEN_ADDRESS]: buildToken({
            chainID: 747474,
            value: 100
          })
        }
      },
      getToken: () =>
        buildToken({
          chainID: 747474,
          value: 100
        })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={747474}
        allowedChainIds={[747474]}
        headerChainOptions={[
          {
            chainId: 747474,
            isActive: true,
            onClick: () => undefined
          },
          {
            chainId: 1,
            isActive: false,
            onClick: () => undefined
          }
        ]}
      />
    )

    expect(html).toContain('alt="Katana"')
    expect(html).toContain('alt="Ethereum"')
  })

  it('excludes Katana when allowedChainIds omit it', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken({
            chainID: 1,
            value: 100
          })
        }
      },
      getToken: () =>
        buildToken({
          chainID: 1,
          value: 100
        })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        allowedChainIds={[1, 10, 137, 42161, 8453]}
      />
    )

    expect(html).toContain('alt="Ethereum"')
    expect(html).toContain('alt="Base"')
    expect(html).not.toContain('alt="Katana"')
  })

  it('preserves wallet balance and value when an extra token only overrides metadata', () => {
    mockUseYearn.mockReturnValue({
      allVaults: {},
      getPrice: () => ({ normalized: 0 })
    })
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken({
            name: 'Wallet Token',
            symbol: 'WLT',
            decimals: 0,
            value: 100,
            balance: {
              raw: 1234n,
              normalized: 1234,
              display: '1234',
              decimals: 0
            }
          }),
          [VAULT_TOKEN_ADDRESS]: buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Lower Value Token',
            symbol: 'LVT',
            decimals: 0,
            value: 50,
            balance: {
              raw: 1n,
              normalized: 1,
              display: '1',
              decimals: 0
            }
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === VAULT_TOKEN_ADDRESS) {
          return buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Lower Value Token',
            symbol: 'LVT',
            decimals: 0,
            value: 50,
            balance: {
              raw: 1n,
              normalized: 1,
              display: '1',
              decimals: 0
            }
          })
        }

        return buildToken({
          name: 'Wallet Token',
          symbol: 'WLT',
          decimals: 0,
          value: 100,
          balance: {
            raw: 1234n,
            normalized: 1234,
            display: '1234',
            decimals: 0
          }
        })
      }
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        mode="deposit"
        extraTokens={[
          buildToken({
            name: 'Override Token',
            symbol: 'OVR',
            decimals: 0,
            value: 0,
            balance: {
              raw: 0n,
              normalized: 0,
              display: '0',
              decimals: 0
            }
          })
        ]}
      />
    )

    expect(html).toContain('Override Token')
    expect(html).toContain('1,234')
    expect(html.indexOf('Override Token')).toBeLessThan(html.indexOf('Lower Value Token'))
  })

  it('uses the asset logo for vault and staking entries', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken({
            address: BASE_TOKEN_ADDRESS,
            name: 'Base Token',
            symbol: 'BASE',
            logoURI: 'https://example.com/base.png'
          }),
          [VAULT_TOKEN_ADDRESS]: buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Vault Token',
            symbol: 'vBASE',
            logoURI: 'https://example.com/vault.png'
          }),
          [STAKING_TOKEN_ADDRESS]: buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Staking Token',
            symbol: 'stBASE',
            logoURI: 'https://example.com/staking.png'
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === BASE_TOKEN_ADDRESS) {
          return buildToken({
            address: BASE_TOKEN_ADDRESS,
            name: 'Base Token',
            symbol: 'BASE',
            logoURI: 'https://example.com/base.png'
          })
        }
        if (address === VAULT_TOKEN_ADDRESS) {
          return buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Vault Token',
            symbol: 'vBASE',
            logoURI: 'https://example.com/vault.png'
          })
        }
        return buildToken({
          address: STAKING_TOKEN_ADDRESS,
          name: 'Staking Token',
          symbol: 'stBASE',
          logoURI: 'https://example.com/staking.png'
        })
      }
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        assetAddress={BASE_TOKEN_ADDRESS}
        vaultAddress={VAULT_TOKEN_ADDRESS}
        stakingAddress={STAKING_TOKEN_ADDRESS}
      />
    )

    expect(html).toContain('https://example.com/base.png')
    expect(html).not.toContain('https://example.com/vault.png')
    expect(html).not.toContain('https://example.com/staking.png')
  })

  it('never shows hidden vault share or staking tokens', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken(),
          [VAULT_TOKEN_ADDRESS]: buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Hidden Vault Token',
            symbol: 'kpdWETH'
          }),
          [STAKING_TOKEN_ADDRESS]: buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Hidden Staking Token',
            symbol: 'stkWETH'
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === VAULT_TOKEN_ADDRESS) {
          return buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Hidden Vault Token',
            symbol: 'kpdWETH'
          })
        }
        if (address === STAKING_TOKEN_ADDRESS) {
          return buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Hidden Staking Token',
            symbol: 'stkWETH'
          })
        }
        return buildToken()
      }
    })
    mockUseYearn.mockReturnValue({
      allVaults: {
        [VAULT_TOKEN_ADDRESS]: {
          chainID: 1,
          version: '3.0.0',
          address: VAULT_TOKEN_ADDRESS,
          token: {
            address: BASE_TOKEN_ADDRESS,
            symbol: 'WETH',
            name: 'Wrapped Ether',
            description: '',
            decimals: 18
          },
          staking: {
            address: STAKING_TOKEN_ADDRESS,
            available: true,
            source: '',
            rewards: null
          },
          info: {
            sourceURL: '',
            riskLevel: 0,
            riskScore: [],
            riskScoreComment: '',
            uiNotice: '',
            isRetired: false,
            isBoosted: false,
            isHighlighted: false,
            isHidden: true
          }
        }
      },
      getPrice: () => ({ normalized: 0 })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        assetAddress={BASE_TOKEN_ADDRESS}
      />
    )

    expect(html).toContain('Base Token')
    expect(html).not.toContain('kpdWETH')
    expect(html).not.toContain('stkWETH')
  })

  it('keeps the hidden vault share token available only for explicit unstake selection', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken(),
          [VAULT_TOKEN_ADDRESS]: buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Hidden Vault Token',
            symbol: 'kpdWETH'
          }),
          [STAKING_TOKEN_ADDRESS]: buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Hidden Staking Token',
            symbol: 'stkWETH'
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === VAULT_TOKEN_ADDRESS) {
          return buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Hidden Vault Token',
            symbol: 'kpdWETH'
          })
        }
        if (address === STAKING_TOKEN_ADDRESS) {
          return buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Hidden Staking Token',
            symbol: 'stkWETH'
          })
        }
        return buildToken()
      }
    })
    mockUseYearn.mockReturnValue({
      allVaults: {
        [VAULT_TOKEN_ADDRESS]: {
          chainID: 1,
          version: '3.0.0',
          address: VAULT_TOKEN_ADDRESS,
          token: {
            address: BASE_TOKEN_ADDRESS,
            symbol: 'WETH',
            name: 'Wrapped Ether',
            description: '',
            decimals: 18
          },
          staking: {
            address: STAKING_TOKEN_ADDRESS,
            available: true,
            source: '',
            rewards: null
          },
          info: {
            sourceURL: '',
            riskLevel: 0,
            riskScore: [],
            riskScoreComment: '',
            uiNotice: '',
            isRetired: false,
            isBoosted: false,
            isHighlighted: false,
            isHidden: true
          }
        }
      },
      getPrice: () => ({ normalized: 0 })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        mode="withdraw"
        assetAddress={BASE_TOKEN_ADDRESS}
        vaultAddress={VAULT_TOKEN_ADDRESS}
        stakingAddress={STAKING_TOKEN_ADDRESS}
        allowHiddenVaultTokenSelection
      />
    )

    expect(html).toContain('kpdWETH')
    expect(html).not.toContain('stkWETH')
  })

  it('keeps hidden vault share tokens excluded for withdraw selectors without explicit unstake allowance', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken(),
          [VAULT_TOKEN_ADDRESS]: buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Hidden Vault Token',
            symbol: 'kpdWETH'
          }),
          [STAKING_TOKEN_ADDRESS]: buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Hidden Staking Token',
            symbol: 'stkWETH'
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === VAULT_TOKEN_ADDRESS) {
          return buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Hidden Vault Token',
            symbol: 'kpdWETH'
          })
        }
        if (address === STAKING_TOKEN_ADDRESS) {
          return buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Hidden Staking Token',
            symbol: 'stkWETH'
          })
        }
        return buildToken()
      }
    })
    mockUseYearn.mockReturnValue({
      allVaults: {
        [VAULT_TOKEN_ADDRESS]: {
          chainID: 1,
          version: '3.0.0',
          address: VAULT_TOKEN_ADDRESS,
          token: {
            address: BASE_TOKEN_ADDRESS,
            symbol: 'WETH',
            name: 'Wrapped Ether',
            description: '',
            decimals: 18
          },
          staking: {
            address: STAKING_TOKEN_ADDRESS,
            available: true,
            source: '',
            rewards: null
          },
          info: {
            sourceURL: '',
            riskLevel: 0,
            riskScore: [],
            riskScoreComment: '',
            uiNotice: '',
            isRetired: false,
            isBoosted: false,
            isHighlighted: false,
            isHidden: true
          }
        }
      },
      getPrice: () => ({ normalized: 0 })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        mode="withdraw"
        assetAddress={BASE_TOKEN_ADDRESS}
        vaultAddress={VAULT_TOKEN_ADDRESS}
        stakingAddress={STAKING_TOKEN_ADDRESS}
      />
    )

    expect(html).not.toContain('kpdWETH')
    expect(html).not.toContain('stkWETH')
  })

  it('never shows locally deprecated legacy tokens from the token registry', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken(),
          [LEGACY_USDAF_ADDRESS]: buildToken({
            address: LEGACY_USDAF_ADDRESS,
            name: 'USDaf Stablecoin',
            symbol: 'USDaf'
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === LEGACY_USDAF_ADDRESS) {
          return buildToken({
            address: LEGACY_USDAF_ADDRESS,
            name: 'USDaf Stablecoin',
            symbol: 'USDaf'
          })
        }
        return buildToken()
      }
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        assetAddress={BASE_TOKEN_ADDRESS}
      />
    )

    expect(html).toContain('Base Token')
    expect(html).not.toContain('USDaf Stablecoin')
  })

  it('keeps the base deposit asset visible while filtering other low-value pinned options', () => {
    mockUseWallet.mockReturnValue({
      isLoading: false,
      balances: {
        1: {
          [BASE_TOKEN_ADDRESS]: buildToken({
            address: BASE_TOKEN_ADDRESS,
            name: 'Visible Token',
            symbol: 'VIS',
            balance: {
              raw: 1n,
              normalized: 1,
              display: '1',
              decimals: 18
            }
          }),
          [VAULT_TOKEN_ADDRESS]: buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Dust Asset',
            symbol: 'DST',
            balance: {
              raw: 5_000_000_000_000_000n,
              normalized: 0.005,
              display: '0.005',
              decimals: 18
            }
          }),
          [STAKING_TOKEN_ADDRESS]: buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Pinned Dust Token',
            symbol: 'PDT',
            balance: {
              raw: 4_000_000_000_000_000n,
              normalized: 0.004,
              display: '0.004',
              decimals: 18
            }
          })
        }
      },
      getToken: ({ address }: { address: string }) => {
        if (address === VAULT_TOKEN_ADDRESS) {
          return buildToken({
            address: VAULT_TOKEN_ADDRESS,
            name: 'Dust Asset',
            symbol: 'DST',
            balance: {
              raw: 5_000_000_000_000_000n,
              normalized: 0.005,
              display: '0.005',
              decimals: 18
            }
          })
        }
        if (address === STAKING_TOKEN_ADDRESS) {
          return buildToken({
            address: STAKING_TOKEN_ADDRESS,
            name: 'Pinned Dust Token',
            symbol: 'PDT',
            balance: {
              raw: 4_000_000_000_000_000n,
              normalized: 0.004,
              display: '0.004',
              decimals: 18
            }
          })
        }

        return buildToken({
          address: BASE_TOKEN_ADDRESS,
          name: 'Visible Token',
          symbol: 'VIS',
          balance: {
            raw: 1n,
            normalized: 1,
            display: '1',
            decimals: 18
          }
        })
      }
    })
    mockUseYearn.mockReturnValue({
      allVaults: {},
      getPrice: () => ({ normalized: 1 })
    })

    const html = renderToStaticMarkup(
      <TokenSelector
        value={BASE_TOKEN_ADDRESS}
        onChange={() => undefined}
        chainId={1}
        mode="deposit"
        assetAddress={VAULT_TOKEN_ADDRESS}
        priorityTokens={{ 1: [VAULT_TOKEN_ADDRESS, STAKING_TOKEN_ADDRESS] }}
        topTokens={{ 1: [VAULT_TOKEN_ADDRESS, STAKING_TOKEN_ADDRESS] }}
      />
    )

    expect(html).toContain('Visible Token')
    expect(html).toContain('Dust Asset')
    expect(html).not.toContain('Pinned Dust Token')
  })
})
