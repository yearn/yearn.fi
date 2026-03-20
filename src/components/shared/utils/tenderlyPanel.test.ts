import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { TDict, TToken } from '@shared/types'
import type { TTenderlyConfiguredChainStatus, TTenderlySnapshotRecord } from '@shared/types/tenderly'
import { describe, expect, it } from 'vitest'
import {
  addTenderlyTimeIncrement,
  buildTenderlyFundableAssets,
  clearTenderlySnapshotBucket,
  convertTenderlyTimeAmountToSeconds,
  getDefaultTenderlyFundableAssets,
  getLastRestorableTenderlySnapshot,
  getValidBaselineSnapshot,
  markTenderlySnapshotInvalid,
  resolveDefaultTenderlyCanonicalChainId,
  upsertTenderlySnapshotRecord
} from './tenderlyPanel'

const configuredChains: TTenderlyConfiguredChainStatus[] = [
  {
    canonicalChainId: 1,
    canonicalChainName: 'Ethereum',
    executionChainId: 694201,
    hasAdminRpc: true
  },
  {
    canonicalChainId: 10,
    canonicalChainName: 'Optimism',
    executionChainId: 694202,
    hasAdminRpc: false
  }
]

const baselineSnapshot: TTenderlySnapshotRecord = {
  snapshotId: '0xbaseline',
  canonicalChainId: 1,
  executionChainId: 694201,
  label: 'Baseline',
  createdAt: '2026-03-16T00:00:00.000Z',
  kind: 'baseline',
  lastKnownStatus: 'valid'
}

describe('resolveDefaultTenderlyCanonicalChainId', () => {
  it('prefers the first preferred chain that has admin RPC access', () => {
    expect(resolveDefaultTenderlyCanonicalChainId(configuredChains, [10, 1])).toBe(1)
  })

  it('falls back to the first available configured chain', () => {
    expect(resolveDefaultTenderlyCanonicalChainId(configuredChains, [8453])).toBe(1)
  })
})

describe('snapshot helpers', () => {
  it('replaces prior baseline snapshots for the same chain bucket', () => {
    const updatedStorage = upsertTenderlySnapshotRecord(
      {
        '1:694201': [baselineSnapshot]
      },
      {
        ...baselineSnapshot,
        snapshotId: '0xbaseline2',
        createdAt: '2026-03-17T00:00:00.000Z'
      }
    )

    expect(updatedStorage['1:694201']).toHaveLength(1)
    expect(updatedStorage['1:694201']?.[0]?.snapshotId).toBe('0xbaseline2')
  })

  it('marks a snapshot invalid and removes it as the valid baseline', () => {
    const updatedStorage = markTenderlySnapshotInvalid(
      {
        '1:694201': [baselineSnapshot]
      },
      {
        canonicalChainId: 1,
        executionChainId: 694201,
        snapshotId: '0xbaseline'
      }
    )

    expect(updatedStorage['1:694201']?.[0]?.lastKnownStatus).toBe('invalid')
    expect(getValidBaselineSnapshot(updatedStorage['1:694201'] || [])).toBeUndefined()
  })

  it('clears local snapshot history for one chain bucket without touching others', () => {
    const snapshotStorage = {
      '1:694201': [baselineSnapshot],
      '8453:69428453': [
        {
          ...baselineSnapshot,
          canonicalChainId: 8453,
          executionChainId: 69428453,
          snapshotId: '0xbase',
          label: 'Base baseline'
        }
      ]
    }

    const updatedStorage = clearTenderlySnapshotBucket(snapshotStorage, {
      canonicalChainId: 1,
      executionChainId: 694201
    })

    expect(updatedStorage['1:694201']).toBeUndefined()
    expect(updatedStorage['8453:69428453']).toEqual(snapshotStorage['8453:69428453'])
  })

  it('returns the latest valid snapshot before falling back to baseline', () => {
    const latestSnapshot: TTenderlySnapshotRecord = {
      ...baselineSnapshot,
      snapshotId: '0xsnapshot-latest',
      label: 'Latest snapshot',
      kind: 'snapshot',
      createdAt: '2026-03-18T00:00:00.000Z'
    }
    const olderSnapshot: TTenderlySnapshotRecord = {
      ...baselineSnapshot,
      snapshotId: '0xsnapshot-older',
      label: 'Older snapshot',
      kind: 'snapshot',
      createdAt: '2026-03-17T00:00:00.000Z'
    }

    expect(getLastRestorableTenderlySnapshot([baselineSnapshot, olderSnapshot, latestSnapshot])?.snapshotId).toBe(
      '0xsnapshot-latest'
    )
    expect(
      getLastRestorableTenderlySnapshot([{ ...latestSnapshot, lastKnownStatus: 'invalid' }, baselineSnapshot])
        ?.snapshotId
    ).toBe('0xbaseline')
  })
})

describe('convertTenderlyTimeAmountToSeconds', () => {
  it('converts curated units into seconds', () => {
    expect(convertTenderlyTimeAmountToSeconds(5, 'minutes')).toBe(300)
    expect(convertTenderlyTimeAmountToSeconds(2, 'hours')).toBe(7_200)
    expect(convertTenderlyTimeAmountToSeconds(14, 'days')).toBe(1_209_600)
  })
})

describe('addTenderlyTimeIncrement', () => {
  it('adds preset time to the current input without executing immediately', () => {
    expect(
      addTenderlyTimeIncrement({
        currentAmount: 14,
        currentUnit: 'days',
        addedAmount: 1,
        addedUnit: 'hours'
      })
    ).toEqual({
      amount: 14.041667,
      unit: 'days',
      seconds: 1_213_200
    })
  })

  it('uses the preset unit when the current input is empty', () => {
    expect(
      addTenderlyTimeIncrement({
        currentAmount: 0,
        currentUnit: 'days',
        addedAmount: 1,
        addedUnit: 'days'
      })
    ).toEqual({
      amount: 1,
      unit: 'days',
      seconds: 86_400
    })
  })
})

describe('buildTenderlyFundableAssets', () => {
  it('includes native, token-list, vault, and staking assets for the selected chain', () => {
    const tokenLists = {
      1: {
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {
          address: '0x7Fc66500c84A76Ad7E9C93437bFc5Ac33E2DDAE9',
          name: 'Aave Token',
          symbol: 'AAVE',
          decimals: 18,
          chainID: 1,
          value: 0,
          balance: { raw: 0n, normalized: 0, display: '0', decimals: 18 }
        } satisfies TToken,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          chainID: 1,
          value: 0,
          balance: { raw: 0n, normalized: 0, display: '0', decimals: 6 }
        } satisfies TToken
      }
    }
    const allVaults = {
      '0xvault': {
        address: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        name: 'Test Vault',
        symbol: 'yvTEST',
        decimals: 18,
        token: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6
        },
        staking: {
          address: '0x2222222222222222222222222222222222222222',
          available: true,
          source: '',
          rewards: []
        }
      }
    } as unknown as TDict<TKongVaultInput>

    const assets = buildTenderlyFundableAssets({
      chainId: 1,
      tokenLists,
      allVaults
    })

    expect(assets.some((asset) => asset.assetKind === 'native' && asset.symbol === 'ETH')).toBe(true)
    expect(assets.some((asset) => asset.symbol === 'USDC' && asset.tokenType === 'asset')).toBe(true)
    expect(assets.some((asset) => asset.symbol === 'yvTEST' && asset.tokenType === 'vault')).toBe(true)
    expect(assets.some((asset) => asset.symbol === 'yvTEST' && asset.tokenType === 'staking')).toBe(true)
    expect(assets.findIndex((asset) => asset.symbol === 'USDC')).toBeLessThan(
      assets.findIndex((asset) => asset.symbol === 'AAVE')
    )
  })

  it('builds a deduplicated default asset list for the faucet without repeated common symbols', () => {
    const defaultAssets = getDefaultTenderlyFundableAssets(
      [
        {
          chainId: 1,
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
          assetKind: 'native',
          tokenType: 'asset'
        },
        {
          chainId: 1,
          address: '0x13Cc8D626445c6fcCC548aAE172CBACF572EF5A4',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          assetKind: 'erc20',
          tokenType: 'asset'
        },
        {
          chainId: 1,
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          assetKind: 'erc20',
          tokenType: 'asset'
        },
        {
          chainId: 1,
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          name: 'Dai Stablecoin',
          symbol: 'DAI',
          decimals: 18,
          assetKind: 'erc20',
          tokenType: 'asset'
        }
      ],
      14
    )

    expect(defaultAssets.map((asset) => asset.symbol)).toEqual(['ETH', 'USDT', 'DAI'])
    expect(defaultAssets[1]?.address).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7')
  })
})
