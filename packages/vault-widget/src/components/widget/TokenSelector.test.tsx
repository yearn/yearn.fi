import { TokenSelector } from '@yearn/vault-widget/internal/components/widget/TokenSelector'
import {
  type VaultWidgetCatalogVault,
  type VaultWidgetRuntimeOverrides,
  VaultWidgetRuntimeProvider,
  type VaultWidgetToken,
  type VaultWidgetTokenReference
} from '@yearn/vault-widget/runtime'
import type { Token } from '@yearn/vault-widget/types'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const BASE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const VAULT_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000002' as const
const STAKING_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000003' as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const LEGACY_USDAF_ADDRESS = '0x85E30b8b263bC64d94b827ed450F2EdFEE8579dA' as const

type TSelectorRuntimeOptions = {
  getPrice?: (token: VaultWidgetTokenReference) => number
  getToken?: (token: VaultWidgetTokenReference) => Token | undefined
  knownVaults?: VaultWidgetCatalogVault[]
  tokens?: Token[]
}

function buildToken(overrides: Partial<Token> = {}): Token {
  return {
    address: BASE_TOKEN_ADDRESS,
    name: 'Base Token',
    symbol: 'BASE',
    decimals: 18,
    chainId: 1,
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

function toRuntimeToken(token: Token): VaultWidgetToken {
  return {
    address: token.address,
    balanceRaw: token.balance.raw,
    chainId: token.chainId,
    decimals: token.decimals,
    logoUri: token.logoURI,
    name: token.name,
    symbol: token.symbol,
    usdValue: token.value
  }
}

function buildTokensByChain(tokens: Token[]): Readonly<Record<number, Readonly<Record<string, VaultWidgetToken>>>> {
  const runtimeTokens = tokens.map(toRuntimeToken)
  const chainIds = [...new Set(runtimeTokens.map((token) => token.chainId))]

  return Object.fromEntries(
    chainIds.map((chainId) => [
      chainId,
      Object.fromEntries(
        runtimeTokens.filter((token) => token.chainId === chainId).map((token) => [token.address, token])
      )
    ])
  )
}

function createRuntime({
  getPrice = () => 0,
  getToken,
  knownVaults = [],
  tokens = []
}: TSelectorRuntimeOptions): VaultWidgetRuntimeOverrides {
  const tokenByKey = new Map(tokens.map((token) => [`${token.chainId}/${token.address.toLowerCase()}`, token] as const))
  const resolveToken =
    getToken ??
    ((token: VaultWidgetTokenReference): Token | undefined =>
      tokenByKey.get(`${token.chainId}/${token.address.toLowerCase()}`))

  return {
    assets: {
      getChainLogoUrl: (chainId) => `/chains/${chainId}/logo.svg`,
      getTokenLogoUrl: ({ address, chainId, size = 32 }) =>
        `/tokens/${chainId}/${address.toLowerCase()}/logo-${size}.png`
    },
    catalog: {
      knownVaults,
      tokenListsByChain: {}
    },
    prices: {
      getUsdPrice: getPrice
    },
    wallet: {
      getToken: (token) => {
        const resolved = resolveToken(token)
        return resolved ? toRuntimeToken(resolved) : undefined
      },
      isLoading: false,
      tokensByChain: buildTokensByChain(tokens)
    }
  }
}

function renderTokenSelector(
  props: ComponentProps<typeof TokenSelector>,
  runtimeOptions: TSelectorRuntimeOptions
): string {
  return renderToStaticMarkup(
    <VaultWidgetRuntimeProvider value={createRuntime(runtimeOptions)}>
      <TokenSelector {...props} />
    </VaultWidgetRuntimeProvider>
  )
}

function buildKnownVault(hidden: boolean): VaultWidgetCatalogVault {
  return {
    address: VAULT_TOKEN_ADDRESS,
    assetAddress: BASE_TOKEN_ADDRESS,
    chainId: 1,
    hidden,
    stakingAddress: STAKING_TOKEN_ADDRESS
  }
}

function getUnavailableToken(): Token {
  return buildToken({
    address: ZERO_ADDRESS,
    name: '',
    symbol: '',
    logoURI: undefined,
    balance: {
      raw: 0n,
      normalized: 0,
      display: '0',
      decimals: 18
    }
  })
}

describe('TokenSelector', () => {
  it('lets extra tokens override selector metadata and logo sources for matching addresses', () => {
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        extraTokens: [
          buildToken({
            name: 'Override Token',
            symbol: 'OVR',
            logoURI: 'https://example.com/override.png'
          })
        ]
      },
      { tokens: [buildToken()] }
    )

    expect(html).toContain('Override Token')
    expect(html).toContain('OVR')
    expect(html).toContain('https://example.com/override.png')
    expect(html).not.toContain('Base Token')
  })

  it('preserves wallet balance and value when an extra token only overrides metadata', () => {
    const walletToken = buildToken({
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
    const lowerValueToken = buildToken({
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
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        mode: 'deposit',
        extraTokens: [
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
        ]
      },
      { tokens: [walletToken, lowerValueToken] }
    )

    expect(html).toContain('Override Token')
    expect(html).toContain('1,234')
    expect(html.indexOf('Override Token')).toBeLessThan(html.indexOf('Lower Value Token'))
  })

  it('uses the asset logo for vault and staking entries', () => {
    const baseToken = buildToken({ logoURI: 'https://example.com/base.png' })
    const vaultToken = buildToken({
      address: VAULT_TOKEN_ADDRESS,
      name: 'Vault Token',
      symbol: 'vBASE',
      logoURI: 'https://example.com/vault.png'
    })
    const stakingToken = buildToken({
      address: STAKING_TOKEN_ADDRESS,
      name: 'Staking Token',
      symbol: 'stBASE',
      logoURI: 'https://example.com/staking.png'
    })
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        assetAddress: BASE_TOKEN_ADDRESS,
        vaultAddress: VAULT_TOKEN_ADDRESS,
        stakingAddress: STAKING_TOKEN_ADDRESS
      },
      { tokens: [baseToken, vaultToken, stakingToken] }
    )

    expect(html).toContain('https://example.com/base.png')
    expect(html).not.toContain('https://example.com/vault.png')
    expect(html).not.toContain('https://example.com/staking.png')
  })

  it('uses the asset logo fallback path for vault entries before asset token metadata loads', () => {
    const vaultToken = buildToken({
      address: VAULT_TOKEN_ADDRESS,
      name: 'Vault Token',
      symbol: 'yvBASE',
      logoURI: 'https://example.com/vault.png'
    })
    const html = renderTokenSelector(
      {
        value: VAULT_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        assetAddress: BASE_TOKEN_ADDRESS,
        vaultAddress: VAULT_TOKEN_ADDRESS
      },
      { tokens: [vaultToken], getToken: getUnavailableToken }
    )

    expect(html).toContain(`/tokens/1/${BASE_TOKEN_ADDRESS}/logo-32.png`)
    expect(html).not.toContain('https://example.com/vault.png')
  })

  it('uses known vault asset logo fallback path for staking tokens from all vaults', () => {
    const stakingToken = buildToken({
      address: STAKING_TOKEN_ADDRESS,
      name: 'yGauge Base Vault',
      symbol: 'yG-yvBASE-1',
      logoURI: 'https://example.com/gauge.png'
    })
    const html = renderTokenSelector(
      {
        value: STAKING_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        mode: 'deposit'
      },
      {
        tokens: [stakingToken],
        getToken: getUnavailableToken,
        knownVaults: [buildKnownVault(false)]
      }
    )

    expect(html).toContain(`/tokens/1/${BASE_TOKEN_ADDRESS}/logo-32.png`)
    expect(html).toContain('yG-yvBASE-1')
    expect(html).toContain('Gauge')
    expect(html).not.toContain('https://example.com/gauge.png')
  })

  it('never shows hidden vault share or staking tokens', () => {
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        assetAddress: BASE_TOKEN_ADDRESS
      },
      {
        tokens: [
          buildToken(),
          buildToken({ address: VAULT_TOKEN_ADDRESS, name: 'Hidden Vault Token', symbol: 'kpdWETH' }),
          buildToken({ address: STAKING_TOKEN_ADDRESS, name: 'Hidden Staking Token', symbol: 'stkWETH' })
        ],
        knownVaults: [buildKnownVault(true)]
      }
    )

    expect(html).toContain('Base Token')
    expect(html).not.toContain('kpdWETH')
    expect(html).not.toContain('stkWETH')
  })

  it('keeps the hidden vault share token available only for explicit unstake selection', () => {
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        mode: 'withdraw',
        assetAddress: BASE_TOKEN_ADDRESS,
        vaultAddress: VAULT_TOKEN_ADDRESS,
        stakingAddress: STAKING_TOKEN_ADDRESS,
        allowHiddenVaultTokenSelection: true
      },
      {
        tokens: [
          buildToken(),
          buildToken({ address: VAULT_TOKEN_ADDRESS, name: 'Hidden Vault Token', symbol: 'kpdWETH' }),
          buildToken({ address: STAKING_TOKEN_ADDRESS, name: 'Hidden Staking Token', symbol: 'stkWETH' })
        ],
        knownVaults: [buildKnownVault(true)]
      }
    )

    expect(html).toContain('kpdWETH')
    expect(html).not.toContain('stkWETH')
  })

  it('keeps hidden vault share tokens excluded for withdraw selectors without explicit unstake allowance', () => {
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        mode: 'withdraw',
        assetAddress: BASE_TOKEN_ADDRESS,
        vaultAddress: VAULT_TOKEN_ADDRESS,
        stakingAddress: STAKING_TOKEN_ADDRESS
      },
      {
        tokens: [
          buildToken(),
          buildToken({ address: VAULT_TOKEN_ADDRESS, name: 'Hidden Vault Token', symbol: 'kpdWETH' }),
          buildToken({ address: STAKING_TOKEN_ADDRESS, name: 'Hidden Staking Token', symbol: 'stkWETH' })
        ],
        knownVaults: [buildKnownVault(true)]
      }
    )

    expect(html).not.toContain('kpdWETH')
    expect(html).not.toContain('stkWETH')
  })

  it('never shows locally deprecated legacy tokens from the token registry', () => {
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        assetAddress: BASE_TOKEN_ADDRESS
      },
      {
        tokens: [buildToken(), buildToken({ address: LEGACY_USDAF_ADDRESS, name: 'USDaf Stablecoin', symbol: 'USDaf' })]
      }
    )

    expect(html).toContain('Base Token')
    expect(html).not.toContain('USDaf Stablecoin')
  })

  it('keeps the base deposit asset visible while filtering other low-value pinned options', () => {
    const visibleToken = buildToken({
      name: 'Visible Token',
      symbol: 'VIS',
      balance: {
        raw: 1n,
        normalized: 1,
        display: '1',
        decimals: 18
      }
    })
    const dustAsset = buildToken({
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
    const pinnedDustToken = buildToken({
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
    const html = renderTokenSelector(
      {
        value: BASE_TOKEN_ADDRESS,
        onChange: () => undefined,
        chainId: 1,
        mode: 'deposit',
        assetAddress: VAULT_TOKEN_ADDRESS,
        priorityTokens: { 1: [VAULT_TOKEN_ADDRESS, STAKING_TOKEN_ADDRESS] },
        topTokens: { 1: [VAULT_TOKEN_ADDRESS, STAKING_TOKEN_ADDRESS] }
      },
      {
        tokens: [visibleToken, dustAsset, pinnedDustToken],
        getPrice: () => 1
      }
    )

    expect(html).toContain('Visible Token')
    expect(html).toContain('Dust Asset')
    expect(html).not.toContain('Pinned Dust Token')
  })
})
