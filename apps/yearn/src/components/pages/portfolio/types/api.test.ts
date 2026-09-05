import { describe, expect, it } from 'vitest'
import { portfolioActivityFacetsResponseSchema, portfolioActivityResponseSchema, portfolioResponseSchema } from './api'

describe('portfolioResponseSchema', () => {
  it('accepts the non-fatal missing exit-price warning and defaults legacy estimate flags', () => {
    const parsed = portfolioResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      denomination: 'usd',
      timeframe: '1y',
      balance: {
        address: '0x2222222222222222222222222222222222222222',
        denomination: 'usd',
        timeframe: '1y',
        dataPoints: []
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
            date: '2026-08-23',
            growthWeightUsd: 2,
            growthUsd: 2,
            growthWeightEth: null,
            protocolReturnPct: 2,
            annualizedProtocolReturnPct: 2,
            growthIndex: 102
          }
        ],
        familySeries: [
          {
            chainId: 1,
            vaultAddress: '0x3333333333333333333333333333333333333333',
            symbol: 'yvTEST',
            status: 'ok',
            dataPoints: [
              {
                timestamp: 1776902400,
                growthWeightUsd: 2,
                growthWeightEth: 0.001,
                growthUsd: 2,
                growthIndex: 102
              }
            ]
          }
        ]
      },
      growth: {
        generatedAt: '2026-08-24T00:00:00.000Z',
        summary: {
          totalVaults: 1,
          completeVaults: 1,
          partialVaults: 0,
          isComplete: true
        },
        vaults: [
          {
            chainId: 1,
            vaultAddress: '0x3333333333333333333333333333333333333333',
            status: 'ok',
            issues: ['missing_exit_price'],
            baselineUsd: 100,
            baselineExposureUsdYears: 1,
            growthUnderlying: 2,
            growthUsd: 2,
            growthPct: 2,
            annualizedProtocolReturnPct: 2,
            metadata: {
              symbol: 'yvTEST',
              decimals: 18,
              assetDecimals: 18,
              tokenAddress: '0x4444444444444444444444444444444444444444'
            }
          }
        ]
      }
    })

    expect(parsed.growth.vaults[0]?.issues).toEqual(['missing_exit_price'])
    expect(parsed.protocolReturn.dataPoints[0]?.growthUsdEstimated).toBe(false)
    expect(parsed.protocolReturn.familySeries[0]?.dataPoints[0]).toMatchObject({
      growthWeightEth: 0.001,
      growthUsdEstimated: false
    })
  })
})

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
