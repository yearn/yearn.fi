import { describe, expect, it } from 'vitest'
import {
  portfolioActivityFacetsResponseSchema,
  portfolioActivityResponseSchema,
  portfolioLedgerGrowthResponseSchema,
  portfolioLedgerHistoryResponseSchema,
  portfolioLedgerSnapshotResponseSchema
} from './api'

describe('portfolioActivityResponseSchema', () => {
  it('accepts transfer activity entries with a direction', () => {
    const parsed = portfolioActivityResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: false,
        nextOffset: null
      },
      entries: [
        {
          chainId: 1,
          txHash: '0xtransfer',
          timestamp: 1776902400,
          action: 'transfer',
          displayType: 'reward_claim',
          transferDirection: 'in',
          vaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          familyVaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          assetSymbol: 'USDC',
          assetAmount: '0',
          assetAmountFormatted: null,
          inputTokenAddress: null,
          inputTokenSymbol: null,
          inputTokenAmount: null,
          inputTokenAmountFormatted: null,
          outputTokenAddress: null,
          outputTokenSymbol: null,
          outputTokenAmount: null,
          outputTokenAmountFormatted: null,
          shareAmount: '1000000000000000000',
          shareAmountFormatted: 1,
          status: 'ok'
        }
      ]
    })

    expect(parsed.entries[0]?.action).toBe('transfer')
    expect(parsed.entries[0]?.displayType).toBe('reward_claim')
    expect(parsed.entries[0]?.transferDirection).toBe('in')
  })

  it('accepts zap display activity entries', () => {
    const parsed = portfolioActivityResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: false,
        nextOffset: null
      },
      entries: [
        {
          chainId: 1,
          txHash: '0xzapperv2',
          timestamp: 1776902400,
          action: 'deposit',
          displayType: 'zap',
          transferDirection: null,
          vaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          familyVaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          assetSymbol: 'USDC',
          assetAmount: '100000000000000000000',
          assetAmountFormatted: 100,
          inputTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          inputTokenSymbol: 'DAI',
          inputTokenAmount: '100000000000000000000',
          inputTokenAmountFormatted: 100,
          outputTokenAddress: null,
          outputTokenSymbol: null,
          outputTokenAmount: null,
          outputTokenAmountFormatted: null,
          shareAmount: '50741940577121965627316',
          shareAmountFormatted: 50741.94057712197,
          status: 'ok'
        }
      ]
    })

    expect(parsed.entries[0]?.action).toBe('deposit')
    expect(parsed.entries[0]?.displayType).toBe('zap')
  })

  it('accepts swap activity entries', () => {
    const parsed = portfolioActivityResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: false,
        nextOffset: null
      },
      entries: [
        {
          chainId: 1,
          txHash: '0xswap',
          timestamp: 1776902400,
          action: 'swap',
          transferDirection: null,
          vaultAddress: '0x3333333333333333333333333333333333333333',
          familyVaultAddress: '0x3333333333333333333333333333333333333333',
          assetSymbol: 'WETH',
          assetAmount: '0',
          assetAmountFormatted: null,
          inputTokenAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          inputTokenSymbol: null,
          inputTokenAmount: '27000000000000000000',
          inputTokenAmountFormatted: 27,
          outputTokenAddress: null,
          outputTokenSymbol: null,
          outputTokenAmount: null,
          outputTokenAmountFormatted: null,
          shareAmount: '37000000000000000000',
          shareAmountFormatted: 37,
          status: 'ok'
        }
      ]
    })

    expect(parsed.entries[0]?.action).toBe('swap')
  })
})

describe('portfolioActivityFacetsResponseSchema', () => {
  it('accepts chain facets without pagination metadata', () => {
    const parsed = portfolioActivityFacetsResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      facets: {
        chainIds: [1, 8453]
      }
    })

    expect(parsed.facets.chainIds).toEqual([1, 8453])
  })
})

describe('portfolio ledger schemas', () => {
  it('accepts a ready server-issued snapshot', () => {
    const parsed = portfolioLedgerSnapshotResponseSchema.parse({
      status: 'ready',
      snapshotId: `snapshot_${'a'.repeat(32)}`,
      revision: 'revision-1',
      sourceGeneration: 2,
      headSource: 'active',
      freshness: 'refreshed',
      latestSettledDayTimestamp: 1_786_060_800,
      eventUpperTimestamp: 1_786_147_200,
      expiresAtMs: 1_786_149_000_000
    })

    expect(parsed.snapshotId).toBe(`snapshot_${'a'.repeat(32)}`)
  })

  it('composes existing balance and protocol-return contracts in one response', () => {
    const parsed = portfolioLedgerHistoryResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      denomination: 'usd',
      timeframe: '1y',
      balance: {
        address: '0x2222222222222222222222222222222222222222',
        denomination: 'usd',
        timeframe: '1y',
        dataPoints: [{ date: '2026-08-07', value: 125 }]
      },
      protocolReturn: {
        address: '0x2222222222222222222222222222222222222222',
        timeframe: '1y',
        summary: {
          totalVaults: 1,
          completeVaults: 1,
          partialVaults: 0,
          recommendedGrowthDisplay: 'usd',
          recommendedGrowthDisplayReason: 'stable_dominant',
          openBaselineCompositionUsd: { stable: 100, ethFamily: 0, other: 0 },
          isComplete: true
        },
        dataPoints: [
          {
            date: '2026-08-07',
            growthWeightUsd: 25,
            growthWeightEth: null,
            protocolReturnPct: 25,
            annualizedProtocolReturnPct: 30,
            growthIndex: 125
          }
        ],
        familySeries: []
      }
    })

    expect(parsed.balance.dataPoints).toHaveLength(1)
    expect(parsed.protocolReturn.dataPoints).toHaveLength(1)
  })

  it('accepts fast underlying growth rows', () => {
    const parsed = portfolioLedgerGrowthResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      generatedAt: '2026-08-08T12:00:00.000Z',
      summary: {
        totalVaults: 1,
        completeVaults: 1,
        partialVaults: 0,
        historicalPpsRequirements: 1,
        historicalPpsCacheHits: 0,
        historicalPpsFetched: 0,
        historicalPpsMissing: 0,
        currentPpsFallbackVaults: 0,
        isComplete: true
      },
      vaults: [
        {
          chainId: 1,
          vaultAddress: '0x3333333333333333333333333333333333333333',
          status: 'ok',
          issues: [],
          shares: '1000000',
          sharesFormatted: 1,
          pricePerShare: 1.25,
          currentUnderlying: 1.25,
          baselineUnderlying: 1,
          realizedBaselineUnderlying: 0,
          unrealizedBaselineUnderlying: 1,
          realizedGrowthUnderlying: 0,
          unrealizedGrowthUnderlying: 0.25,
          growthUnderlying: 0.25,
          growthPct: 25,
          baselineExposureUnderlyingYears: 1,
          annualizedProtocolReturnPct: 25,
          receiptCount: 1,
          exitCount: 0,
          deposits: 1,
          withdrawals: 0,
          transfersIn: 0,
          transfersOut: 0,
          unmatchedExitShares: '0',
          unmatchedExitSharesFormatted: 0,
          metadata: {
            symbol: 'USDC',
            decimals: 6,
            assetDecimals: 6,
            tokenAddress: '0x4444444444444444444444444444444444444444'
          }
        }
      ]
    })

    expect(parsed.vaults[0]?.growthUnderlying).toBe(0.25)
    expect(parsed.vaults[0]?.growthPct).toBe(25)
    expect(parsed.vaults[0]?.annualizedProtocolReturnPct).toBe(25)
  })
})
