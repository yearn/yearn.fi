import { describe, expect, it } from 'vitest'
import { getVaultHoldingsUsdValue, matchesSelectedChains } from './useVaultFilterUtils'

const VAULT_ADDRESS = '0x8589462548984c5C0f2C0140FB276351B5a77fe1'
const ASSET_ADDRESS = '0x0000000000000000000000000000000000000002'
const USDS_VAULT_ADDRESS = '0x182863131F9a4630fF9E27830d945B1413e347E8'
const USDS_STAKING_ADDRESS = '0xd57aEa3686d623dA2dCEbc87010a4F2F38Ac7B15'
const USDC_VAULT_ADDRESS = '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
const USDC_STAKING_ADDRESS = '0x622fA41799406B120f9a40dA843D358b7b2CFEE3'

function makeStrategyVault() {
  return {
    chainId: 1,
    address: VAULT_ADDRESS,
    name: 'Strategy Vault',
    symbol: 'yvSTRAT',
    apiVersion: '3.0.0',
    decimals: 18,
    asset: {
      address: ASSET_ADDRESS,
      name: 'USD Asset',
      symbol: 'USDC',
      decimals: 6
    },
    tvl: 0,
    performance: {
      oracle: { apr: 0.04, apy: 0.04 },
      estimated: { apr: 0.04, apy: 0.04, type: 'oracle', components: {} },
      historical: { net: 0.03, weeklyNet: 0.03, monthlyNet: 0.02, inceptionNet: 0.01 }
    },
    fees: {
      managementFee: 0,
      performanceFee: 0
    },
    category: 'Stablecoin',
    type: 'Standard',
    kind: 'Single Strategy',
    v3: true,
    yearn: true,
    isRetired: false,
    isHidden: false,
    isBoosted: false,
    isHighlighted: false,
    strategiesCount: 1,
    riskLevel: 1,
    staking: {
      address: null,
      available: false,
      source: '',
      rewards: []
    },
    pricePerShare: '1050000'
  } as any
}

function makeDisabledGaugeVault(address: string, stakingAddress: string, tvlPrice = 1) {
  return {
    version: '3.0.0',
    chainID: 1,
    address,
    name: 'Disabled Gauge Vault',
    symbol: 'yvUSD',
    decimals: 18,
    token: {
      address: ASSET_ADDRESS,
      name: 'USD Asset',
      symbol: 'USDC',
      decimals: 6
    },
    tvl: {
      totalAssets: 0n,
      tvl: 100,
      price: tvlPrice
    },
    apr: {
      pricePerShare: {
        today: 1.05,
        weekAgo: null,
        monthAgo: null
      }
    },
    staking: {
      address: stakingAddress,
      available: false,
      source: 'VeYFI',
      rewards: []
    }
  } as any
}

function makeStakingAddressAsVault(address: string) {
  return {
    version: '3.0.0',
    chainID: 1,
    address,
    name: 'Gauge Wrapper',
    symbol: 'yG',
    decimals: 18,
    token: {
      address: ASSET_ADDRESS,
      name: 'USD Asset',
      symbol: 'USDC',
      decimals: 6
    },
    tvl: {
      totalAssets: 0n,
      tvl: 0,
      price: 0
    },
    apr: {
      pricePerShare: {
        today: 0,
        weekAgo: null,
        monthAgo: null
      }
    },
    staking: {
      address: null,
      available: false,
      source: '',
      rewards: []
    }
  } as any
}

describe('getVaultHoldingsUsdValue', () => {
  it('values list-only holdings from list pricePerShare when share price is unavailable', () => {
    const vault = makeStrategyVault()
    const value = getVaultHoldingsUsdValue(
      vault,
      ({ address }) => ({ value: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? 0 : undefined }),
      ({ address }) => ({
        raw: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? 2n * 10n ** 18n : 0n,
        normalized: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? 2 : 0,
        display: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? '2' : '0',
        decimals: 18
      }),
      ({ address }) => ({
        normalized: address.toLowerCase() === ASSET_ADDRESS.toLowerCase() ? 1 : 0
      })
    )

    expect(value).toBeCloseTo(2.1, 8)
  })

  it.each([
    [USDS_VAULT_ADDRESS, USDS_STAKING_ADDRESS],
    [USDC_VAULT_ADDRESS, USDC_STAKING_ADDRESS]
  ])('adds disabled veYFI gauge shares to direct vault shares for %s', (vaultAddress, stakingAddress) => {
    const vault = makeDisabledGaugeVault(vaultAddress, stakingAddress)
    const value = getVaultHoldingsUsdValue(
      vault,
      () => ({ value: 0 }),
      ({ address }) => {
        const normalizedAddress = address.toLowerCase()
        const normalizedVaultAddress = vaultAddress.toLowerCase()
        const normalizedStakingAddress = stakingAddress.toLowerCase()
        const normalized =
          normalizedAddress === normalizedVaultAddress ? 2 : normalizedAddress === normalizedStakingAddress ? 3 : 0
        return {
          raw: BigInt(normalized) * 10n ** 18n,
          normalized,
          display: String(normalized),
          decimals: 18
        }
      },
      () => ({ normalized: 0 }),
      {
        allVaults: {
          [stakingAddress]: makeStakingAddressAsVault(stakingAddress)
        }
      }
    )

    expect(value).toBeCloseTo(5.25, 8)
  })

  it('uses direct vault share value to value disabled veYFI staking shares when tvl price is unavailable', () => {
    const vault = makeDisabledGaugeVault(USDC_VAULT_ADDRESS, USDC_STAKING_ADDRESS, 0)
    const value = getVaultHoldingsUsdValue(
      vault,
      ({ address }) => ({ value: address.toLowerCase() === USDC_VAULT_ADDRESS.toLowerCase() ? 2.1 : 0 }),
      ({ address }) => {
        const normalizedAddress = address.toLowerCase()
        const normalized =
          normalizedAddress === USDC_VAULT_ADDRESS.toLowerCase()
            ? 2
            : normalizedAddress === USDC_STAKING_ADDRESS.toLowerCase()
              ? 3
              : 0
        return {
          raw: BigInt(normalized) * 10n ** 18n,
          normalized,
          display: String(normalized),
          decimals: 18
        }
      },
      () => ({ normalized: 0 }),
      {
        allVaults: {
          [USDC_STAKING_ADDRESS]: makeStakingAddressAsVault(USDC_STAKING_ADDRESS)
        }
      }
    )

    expect(value).toBeCloseTo(5.25, 8)
  })
})

describe('matchesSelectedChains', () => {
  it('treats null or empty selections as all chains', () => {
    expect(matchesSelectedChains(1, null)).toBe(true)
    expect(matchesSelectedChains(1, [])).toBe(true)
  })

  it('only matches vaults from the selected chains', () => {
    expect(matchesSelectedChains(1, [1])).toBe(true)
    expect(matchesSelectedChains(10, [1])).toBe(false)
  })
})
