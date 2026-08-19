import {
  normalizeTokenForWidget,
  normalizeVaultForWidget,
  normalizeVaultUserDataForWidget
} from '@pages/vaults/components/widget/vaultWidgetAdapter'
import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import type { TToken } from '@shared/types'
import { describe, expect, it } from 'vitest'

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const ASSET_ADDRESS = '0x2222222222222222222222222222222222222222'
const STAKING_ADDRESS = '0x3333333333333333333333333333333333333333'
const MIGRATION_ADDRESS = '0x4444444444444444444444444444444444444444'
const MIGRATION_CONTRACT = '0x5555555555555555555555555555555555555555'

const KONG_VAULT_VIEW = {
  address: VAULT_ADDRESS,
  chainID: 1,
  version: '3.0.4',
  decimals: 18,
  symbol: 'yvUSDC',
  name: 'USDC Vault',
  token: {
    address: ASSET_ADDRESS,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin'
  },
  apr: {
    forwardAPR: {
      netAPR: 0.042
    }
  },
  staking: {
    address: STAKING_ADDRESS,
    available: true,
    source: 'VeYFI'
  },
  migration: {
    available: true,
    address: MIGRATION_ADDRESS,
    contract: MIGRATION_CONTRACT
  },
  info: {
    isRetired: false,
    isHidden: true
  }
} as unknown as TKongVaultInput

describe('normalizeVaultForWidget', () => {
  it('maps Yearn Kong vault metadata to the package contract', () => {
    expect(normalizeVaultForWidget(KONG_VAULT_VIEW)).toEqual({
      address: VAULT_ADDRESS,
      chainId: 1,
      version: '3.0.4',
      decimals: 18,
      symbol: 'yvUSDC',
      name: 'USDC Vault',
      asset: {
        address: ASSET_ADDRESS,
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin'
      },
      forwardAPR: 0.042,
      staking: {
        address: STAKING_ADDRESS,
        source: 'VeYFI'
      },
      migration: {
        available: true,
        address: MIGRATION_ADDRESS,
        contract: MIGRATION_CONTRACT
      },
      isRetired: false,
      isHidden: true
    })
  })
})

describe('normalizeVaultUserDataForWidget', () => {
  it('preserves shared widget token metadata', () => {
    const balance = {
      raw: 1_000_000n,
      normalized: 1,
      display: '1',
      decimals: 6
    }
    const userData = {
      assetToken: {
        address: ASSET_ADDRESS,
        chainId: 10,
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
        balance
      },
      vaultToken: undefined,
      stakingToken: undefined,
      pricePerShare: 1_000_000n,
      availableToDeposit: 1_000_000n,
      depositedShares: 0n,
      depositedValue: 0n,
      stakingWithdrawableAssets: 0n,
      stakingRedeemableShares: 0n,
      isLoading: false,
      refetch: () => undefined
    } satisfies VaultUserData

    const normalized = normalizeVaultUserDataForWidget(userData, 1)

    expect(normalized.assetToken).toEqual({
      address: ASSET_ADDRESS,
      chainId: 10,
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
      balance
    })
    expect(normalized.vaultToken).toBeUndefined()
    expect(normalized.pricePerShare).toBe(1_000_000n)
  })
})

describe('normalizeTokenForWidget', () => {
  it('converts an app token chainID for the shared widget', () => {
    const token = {
      address: ASSET_ADDRESS,
      chainID: 10,
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
      value: 1,
      balance: {
        raw: 1_000_000n,
        normalized: 1,
        display: '1',
        decimals: 6
      }
    } satisfies TToken

    expect(normalizeTokenForWidget(token, 1)).toMatchObject({
      address: ASSET_ADDRESS,
      chainId: 10,
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin'
    })
  })
})
