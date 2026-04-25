import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { afterEach, describe, expect, it } from 'vitest'
import {
  filterCatalogYieldSplitterVaults,
  getCanonicalHoldingsVaultAddress,
  getHoldingsAliasVaultAddress,
  primeYieldSplitterHoldingsAliases,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from './normalizeVault'

function makeVault(overrides: Partial<TKongVaultListItem>): TKongVaultListItem {
  return {
    address: '0x1111111111111111111111111111111111111111',
    chainId: 1,
    origin: 'yearn',
    inclusion: undefined,
    token: {
      address: '0x2222222222222222222222222222222222222222',
      name: 'Token',
      symbol: 'TKN',
      decimals: 18
    },
    staking: undefined,
    metadata: {
      protocols: []
    },
    ...overrides
  } as TKongVaultListItem
}

afterEach(() => {
  primeYieldSplitterHoldingsAliases({})
})

describe('holdings alias helpers', () => {
  it('maps the yBOLD staking wrapper to the base vault', () => {
    expect(getHoldingsAliasVaultAddress(YBOLD_STAKING_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
    expect(getCanonicalHoldingsVaultAddress(YBOLD_STAKING_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
  })

  it('keeps non-aliased vaults canonicalized to themselves', () => {
    expect(getHoldingsAliasVaultAddress(YBOLD_VAULT_ADDRESS)).toBeUndefined()
    expect(getCanonicalHoldingsVaultAddress(YBOLD_VAULT_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
  })

  it('aliases yield splitter holdings back to the source vault and removes splitter rows from the catalog', () => {
    const sourceVault = makeVault({
      address: '0x3333333333333333333333333333333333333333'
    })
    const splitterVault = makeVault({
      address: '0x4444444444444444444444444444444444444444',
      yieldSplitter: {
        enabled: true,
        sourceVaultAddress: sourceVault.address,
        sourceVaultName: 'Source Vault',
        sourceVaultSymbol: 'yvSRC',
        wantVaultAddress: '0x5555555555555555555555555555555555555555',
        wantVaultName: 'Want Vault',
        wantVaultSymbol: 'yvWANT',
        depositAssetAddress: sourceVault.asset?.address ?? '0x0000000000000000000000000000000000000000',
        depositAssetName: sourceVault.asset?.name ?? '',
        depositAssetSymbol: sourceVault.asset?.symbol ?? '',
        rewardTokenAddresses: []
      } as never
    })

    const vaults = {
      [sourceVault.address.toLowerCase()]: sourceVault,
      [splitterVault.address.toLowerCase()]: splitterVault
    }

    primeYieldSplitterHoldingsAliases(vaults)

    expect(getHoldingsAliasVaultAddress(splitterVault.address)).toBe(sourceVault.address)
    expect(getCanonicalHoldingsVaultAddress(splitterVault.address)).toBe(sourceVault.address)

    const filteredVaults = filterCatalogYieldSplitterVaults(vaults)
    expect(filteredVaults[sourceVault.address.toLowerCase()]).toBeDefined()
    expect(filteredVaults[splitterVault.address.toLowerCase()]).toBeUndefined()
  })
})
