import { buildVaultsInitialPayload, getVaultsInitialVaultSource } from '@pages/vaults/utils/vaultsInitialPayload'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const PARTNER_VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'
const UNSUPPORTED_VAULT_ADDRESS = '0x3333333333333333333333333333333333333333'
const ASSET_ADDRESS = '0x4444444444444444444444444444444444444444'

function makeVault(overrides: Partial<TKongVaultListItem> = {}): TKongVaultListItem {
  return {
    chainId: 1,
    address: VAULT_ADDRESS,
    name: 'USDC Vault',
    symbol: 'yvUSDC',
    apiVersion: '3.0.4',
    decimals: 18,
    asset: {
      address: ASSET_ADDRESS,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    tvl: 123_456,
    performance: {
      oracle: {
        apr: 0.04,
        apy: 0.041,
        netAPR: 0.035,
        netAPY: 0.036
      },
      estimated: {
        apr: 0.05,
        apy: 0.052,
        type: 'estimated',
        components: {
          boost: 0,
          poolAPY: 0,
          boostedAPR: 0,
          baseAPR: 0.04,
          rewardsAPR: 0.01
        }
      },
      historical: {
        net: 0.03,
        weeklyNet: 0.031,
        monthlyNet: 0.032,
        inceptionNet: 0.033
      }
    },
    fees: {
      managementFee: 0,
      performanceFee: 1000
    },
    category: 'Stablecoin',
    type: 'Standard',
    kind: 'Multi Strategy',
    v3: true,
    yearn: true,
    isRetired: false,
    isHidden: false,
    isBoosted: false,
    isHighlighted: true,
    inclusion: { isYearn: true },
    migration: false,
    origin: 'yearn',
    strategiesCount: 1,
    riskLevel: 2,
    staking: {
      address: zeroAddress,
      available: false,
      source: '',
      rewards: []
    },
    pricePerShare: '1000000000000000000',
    ...overrides
  } as TKongVaultListItem
}

describe('vaults initial payload', () => {
  it('builds a serializable vault source for default list rendering', () => {
    const payload = buildVaultsInitialPayload([
      makeVault(),
      makeVault({ address: PARTNER_VAULT_ADDRESS, origin: 'partner', inclusion: { isYearn: true } as never }),
      makeVault({ address: UNSUPPORTED_VAULT_ADDRESS, chainId: 999_999 })
    ])

    expect(payload.vaults).toHaveLength(1)
    const source = getVaultsInitialVaultSource(payload)
    const vault = source?.vaults[VAULT_ADDRESS]

    expect(source?.allVaults[VAULT_ADDRESS]).toBe(vault)
    expect(source?.allVaults[PARTNER_VAULT_ADDRESS]).toBeUndefined()
    expect(vault).toMatchObject({
      address: VAULT_ADDRESS,
      chainID: 1,
      name: 'USDC Vault',
      symbol: 'yvUSDC',
      token: {
        address: ASSET_ADDRESS,
        symbol: 'USDC'
      },
      tvl: {
        tvl: 123_456,
        totalAssets: 0n
      },
      info: {
        isHighlighted: true
      }
    })
  })

  it('rehydrates serialized bigint fields for client selectors', () => {
    const payload = buildVaultsInitialPayload([makeVault()])
    const source = getVaultsInitialVaultSource(payload)
    const vault = source?.vaults[VAULT_ADDRESS]

    expect(source?.isLoadingVaultList).toBe(false)
    expect(vault?.tvl.totalAssets).toBe(0n)
    expect(vault?.apr.forwardAPR.netAPR).toBe(0.036)
    expect(vault?.token.symbol).toBe('USDC')
  })
})
