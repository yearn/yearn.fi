import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import type { TAddress, TNormalizedBN, TToken } from '@shared/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWalletVaultTotals } from './useWalletVaultTotals'

const VISIBLE_VAULT_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const HIDDEN_VAULT_ADDRESS = '0x0000000000000000000000000000000000000002' as const
const HIDDEN_STAKING_ADDRESS = '0x0000000000000000000000000000000000000003' as const
const ASSET_ADDRESS = '0x0000000000000000000000000000000000000004' as const
const STAKED_VISIBLE_VAULT_ADDRESS = '0x0000000000000000000000000000000000000005' as const
const STAKED_VISIBLE_STAKING_ADDRESS = '0x0000000000000000000000000000000000000006' as const

const { mockGetVaultHoldingsUsd, mockUseWalletTokens, mockUseYearn } = vi.hoisted(() => ({
  mockGetVaultHoldingsUsd: vi.fn(),
  mockUseWalletTokens: vi.fn(),
  mockUseYearn: vi.fn()
}))

vi.mock('@pages/vaults/contexts/useAppSettings', () => ({
  useAppSettings: () => ({ shouldHideDust: false })
}))

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: () => ({ lockedVault: undefined, unlockedVault: undefined })
}))

vi.mock('@shared/contexts/useWallet', () => ({
  useWalletHoldings: () => ({ getVaultHoldingsUsd: mockGetVaultHoldingsUsd }),
  useWalletTokens: mockUseWalletTokens
}))

vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: mockUseYearn
}))

function makeBalance(raw: bigint, decimals = 6): TNormalizedBN {
  const normalized = Number(raw) / 10 ** decimals
  return { raw, normalized, display: normalized.toString(), decimals }
}

function makeToken(address: TAddress, value: number): TToken {
  return {
    address,
    name: 'Vault Token',
    symbol: 'yvTEST',
    decimals: 6,
    chainID: 1,
    value,
    balance: makeBalance(BigInt(Math.round(value * 1_000_000)))
  }
}

function makeVault({
  address,
  isHidden,
  stakingAddress
}: {
  address: TAddress
  isHidden: boolean
  stakingAddress?: TAddress
}): TKongVault {
  return {
    address,
    version: '3.0.0',
    type: 'Standard',
    kind: 'Multi Strategy',
    symbol: 'yvTEST',
    name: 'Test Vault',
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
      address: stakingAddress,
      available: Boolean(stakingAddress),
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
      isHidden
    }
  } as unknown as TKongVault
}

function renderTotals(): ReturnType<typeof useWalletVaultTotals> {
  const resultRef: { current?: ReturnType<typeof useWalletVaultTotals> } = {}

  const HookResult = () => {
    resultRef.current = useWalletVaultTotals()
    return null
  }

  renderToStaticMarkup(<HookResult />)
  if (!resultRef.current) {
    throw new Error('Wallet vault totals hook did not render')
  }
  return resultRef.current
}

describe('useWalletVaultTotals', () => {
  beforeEach(() => {
    const visibleVault = makeVault({ address: VISIBLE_VAULT_ADDRESS, isHidden: false })
    const hiddenVault = makeVault({
      address: HIDDEN_VAULT_ADDRESS,
      isHidden: true,
      stakingAddress: HIDDEN_STAKING_ADDRESS
    })

    mockUseYearn.mockReturnValue({
      allVaults: {
        [VISIBLE_VAULT_ADDRESS]: visibleVault,
        [HIDDEN_VAULT_ADDRESS]: hiddenVault
      }
    })
    mockGetVaultHoldingsUsd.mockImplementation((vault: TKongVault) =>
      vault.address === VISIBLE_VAULT_ADDRESS ? 19.31 : 346.52
    )
  })


  it('excludes direct hidden vault balances from wallet totals', () => {
    mockUseWalletTokens.mockReturnValue({
      balances: {
        1: {
          [VISIBLE_VAULT_ADDRESS]: makeToken(VISIBLE_VAULT_ADDRESS, 19.31),
          [HIDDEN_VAULT_ADDRESS]: makeToken(HIDDEN_VAULT_ADDRESS, 346.52)
        }
      }
    })

    expect(renderTotals()).toEqual({
      cumulatedValueInV2Vaults: 0,
      cumulatedValueInV3Vaults: 19.31,
      totalValue: 19.31
    })
  })


  it('excludes balances mapped through a hidden vault staking token', () => {
    mockUseWalletTokens.mockReturnValue({
      balances: {
        1: {
          [VISIBLE_VAULT_ADDRESS]: makeToken(VISIBLE_VAULT_ADDRESS, 19.31),
          [HIDDEN_STAKING_ADDRESS]: makeToken(HIDDEN_STAKING_ADDRESS, 346.52)
        }
      }
    })

    expect(renderTotals().totalValue).toBe(19.31)
  })

  // Regression test for #1013 ("Bug: Incorrect Portfolio total balance"): when a wallet
  // holds both the raw vault-share token AND the staking token for the SAME visible
  // vault, the vault's holdings value must be counted exactly once, not twice.
  it('counts a visible vault only once when both its vault token and staking token are held', () => {
    const stakedVisibleVault = makeVault({
      address: STAKED_VISIBLE_VAULT_ADDRESS,
      isHidden: false,
      stakingAddress: STAKED_VISIBLE_STAKING_ADDRESS
    })

    mockUseYearn.mockReturnValue({
      allVaults: {
        [VISIBLE_VAULT_ADDRESS]: makeVault({ address: VISIBLE_VAULT_ADDRESS, isHidden: false }),
        [STAKED_VISIBLE_VAULT_ADDRESS]: stakedVisibleVault
      }
    })
    mockGetVaultHoldingsUsd.mockImplementation((vault: TKongVault) =>
      vault.address === STAKED_VISIBLE_VAULT_ADDRESS ? 500 : 0
    )
    mockUseWalletTokens.mockReturnValue({
      balances: {
        1: {
          [STAKED_VISIBLE_VAULT_ADDRESS]: makeToken(STAKED_VISIBLE_VAULT_ADDRESS, 500),
          [STAKED_VISIBLE_STAKING_ADDRESS]: makeToken(STAKED_VISIBLE_STAKING_ADDRESS, 500)
        }
      }
    })

    expect(renderTotals().totalValue).toBe(500)
  })

})
