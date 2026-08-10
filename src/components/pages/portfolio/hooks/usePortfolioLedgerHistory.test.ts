import {
  buildPortfolioLedgerHistoryEndpoint,
  getPortfolioLedgerHistoryCacheKey,
  transformPortfolioLedgerHistoryResponse
} from '@pages/portfolio/hooks/usePortfolioLedgerHistory'
import type { TPortfolioLedgerHistoryResponse, TPortfolioLiveBalanceSnapshot } from '@pages/portfolio/types/api'
import { describe, expect, it } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SNAPSHOT_ID = `snapshot_${'a'.repeat(32)}`

function createCombinedResponse(): TPortfolioLedgerHistoryResponse {
  return {
    address: ADDRESS,
    version: 'all',
    denomination: 'usd',
    timeframe: '1y',
    balance: {
      address: ADDRESS,
      denomination: 'usd',
      timeframe: '1y',
      dataPoints: [{ date: '2026-08-07', value: 100 }]
    },
    protocolReturn: {
      address: ADDRESS,
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
          growthWeightUsd: 10,
          growthWeightEth: null,
          protocolReturnPct: 10,
          annualizedProtocolReturnPct: 12,
          growthIndex: 110
        }
      ],
      familySeries: []
    }
  }
}

describe('portfolio ledger history helpers', () => {
  it('builds one combined endpoint with the pinned snapshot', () => {
    const endpoint = buildPortfolioLedgerHistoryEndpoint({
      address: ADDRESS,
      snapshotId: SNAPSHOT_ID,
      denomination: 'eth',
      timeframe: 'all'
    })

    expect(endpoint).toBe(
      `/api/holdings/ledger/portfolio-history?address=${ADDRESS}&snapshotId=${SNAPSHOT_ID}&denomination=eth&timeframe=all`
    )
    expect(getPortfolioLedgerHistoryCacheKey(endpoint, SNAPSHOT_ID)).toEqual([
      'fetch',
      endpoint,
      'portfolio-ledger-history',
      SNAPSHOT_ID
    ])
  })

  it('exposes both legacy-compatible shapes and adds the live balance point', () => {
    const liveSnapshot: TPortfolioLiveBalanceSnapshot = {
      date: '2026-08-08',
      totalUsd: 125,
      totalEth: 0.05,
      vaults: []
    }

    const result = transformPortfolioLedgerHistoryResponse({
      rawData: createCombinedResponse(),
      denomination: 'usd',
      timeframe: '1y',
      liveSnapshot
    })

    expect(result.balanceData).toEqual([
      { date: '2026-08-07', value: 100 },
      { date: '2026-08-08', value: 125, isLive: true }
    ])
    expect(result.protocolReturnData?.[0]).toMatchObject({
      growthWeightUsd: 10,
      protocolReturnPct: 10
    })
  })
})
