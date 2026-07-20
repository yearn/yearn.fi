import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import type { TToken } from '@shared/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useYearnTokens } from './useYearn.helper'

const VAULT_ADDRESS = '0x0000000000000000000000000000000000000002' as const
const ASSET_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const STAKING_ADDRESS = '0x0000000000000000000000000000000000000003' as const
const USDC_VAULT_ADDRESS = '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204' as const
const USDC_STAKING_ADDRESS = '0x622fA41799406B120f9a40dA843D358b7b2CFEE3' as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const { mockUseTokenList } = vi.hoisted(() => ({
  mockUseTokenList: vi.fn()
}))

vi.mock('@shared/contexts/WithTokenList', () => ({
  useTokenList: mockUseTokenList
}))

vi.mock('@shared/hooks/useChainID', () => ({
  useChainID: () => ({
    safeChainID: 1
  })
}))

const vault = {
  address: VAULT_ADDRESS,
  version: '3.0.0',
  type: 'Standard',
  kind: 'Single Strategy',
  symbol: 'yvUSDC-1',
  name: 'USDC Vault',
  description: '',
  category: '',
  decimals: 6,
  chainID: 1,
  token: {
    address: ASSET_ADDRESS,
    symbol: 'USDC',
    name: 'USD Coin',
    description: '',
    decimals: 6
  },
  tvl: {},
  apr: {},
  featuringScore: 0,
  strategies: null,
  staking: {
    address: STAKING_ADDRESS,
    available: true,
    source: '',
    rewards: null
  },
  migration: {},
  info: {
    sourceURL: '',
    riskLevel: 0,
    riskScore: [],
    riskScoreComment: '',
    uiNotice: '',
    isRetired: false,
    isBoosted: false,
    isHighlighted: false,
    isHidden: false
  }
} as unknown as TKongVault

function tokenListToken(overrides: Partial<TToken> = {}): TToken {
  return {
    address: STAKING_ADDRESS,
    name: 'yGauge USDC-1 yVault',
    symbol: 'yG-yvUSDC-1',
    decimals: 18,
    chainID: 1,
    value: 0,
    balance: {
      raw: 0n,
      normalized: 0,
      display: '0',
      decimals: 18
    },
    ...overrides
  }
}

function renderHookResult(
  vaults: Record<string, TKongVault> = { [VAULT_ADDRESS]: vault }
): ReturnType<typeof useYearnTokens> {
  let result: ReturnType<typeof useYearnTokens> = []

  const HookResult = () => {
    result = useYearnTokens({
      vaults,
      isLoadingVaultList: false
    })
    return null
  }

  renderToStaticMarkup(<HookResult />)

  return result
}

describe('useYearnTokens', () => {
  it('does not seed staking token decimals from the parent vault', () => {
    mockUseTokenList.mockReturnValue({
      currentNetworkTokenList: {},
      tokenLists: {}
    })

    const stakingToken = renderHookResult().find((token) => token.address === STAKING_ADDRESS)

    expect(stakingToken?.symbol).toBe('yvUSDC-1')
    expect(stakingToken?.decimals).toBeUndefined()
  })

  it('uses token-list decimals and metadata for staking tokens when available', () => {
    mockUseTokenList.mockReturnValue({
      currentNetworkTokenList: {},
      tokenLists: {
        1: {
          [STAKING_ADDRESS]: tokenListToken()
        }
      }
    })

    const stakingToken = renderHookResult().find((token) => token.address === STAKING_ADDRESS)

    expect(stakingToken?.symbol).toBe('yG-yvUSDC-1')
    expect(stakingToken?.decimals).toBe(18)
  })

  it('keeps disabled veYFI gauges on the staking-only balance route when their address is also returned as a vault', () => {
    mockUseTokenList.mockReturnValue({
      currentNetworkTokenList: {},
      tokenLists: {}
    })

    const parentVault = {
      ...vault,
      address: USDC_VAULT_ADDRESS,
      staking: {
        address: USDC_STAKING_ADDRESS,
        available: false,
        source: 'VeYFI',
        rewards: null
      }
    } as unknown as TKongVault
    const gaugeAddressAsVault = {
      ...vault,
      address: USDC_STAKING_ADDRESS,
      staking: {
        address: ZERO_ADDRESS,
        available: false,
        source: '',
        rewards: null
      }
    } as unknown as TKongVault
    const tokens = renderHookResult({
      [USDC_VAULT_ADDRESS]: parentVault,
      [USDC_STAKING_ADDRESS]: gaugeAddressAsVault
    })
    const parentToken = tokens.find((token) => token.address.toLowerCase() === USDC_VAULT_ADDRESS.toLowerCase())
    const stakingToken = tokens.find((token) => token.address.toLowerCase() === USDC_STAKING_ADDRESS.toLowerCase())

    expect(parentToken?.isStakingOnlyPair).toBe(true)
    expect(parentToken?.isVaultBackedStaking).not.toBe(true)
    expect(stakingToken?.isStakingOnlyPair).toBe(true)
    expect(stakingToken?.isVaultBackedStaking).not.toBe(true)
    expect(stakingToken?.isStakingToken).toBe(true)
  })
})
