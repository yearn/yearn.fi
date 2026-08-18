import {
  buildPortfolioLedgerPortfolioEndpoint,
  doesPortfolioLedgerPortfolioResponseMatchRequest,
  fetchPortfolioLedgerPortfolio,
  getPortfolioLedgerPortfolioCacheKey,
  getPortfolioLedgerPortfolioRetryDelay,
  PortfolioLedgerPortfolioError,
  resolvePortfolioLedgerPortfolioQueryState,
  shouldRetryPortfolioLedgerPortfolio,
  transformPortfolioLedgerPortfolioResponse
} from '@pages/portfolio/hooks/usePortfolioLedgerPortfolio'
import {
  portfolioLedgerPortfolioResponseSchema,
  type TPortfolioLedgerPortfolioResponse,
  type TPortfolioLiveBalanceSnapshot
} from '@pages/portfolio/types/api'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'

function createCombinedResponse(): TPortfolioLedgerPortfolioResponse {
  return {
    address: ADDRESS,
    version: 'all',
    denomination: 'usd',
    timeframe: '1y',
    ledger: {
      revision: 'revision-1',
      eventRevision: 'event-revision-1',
      appliedInvalidationSequence: 2,
      freshness: 'refreshed',
      syncedAtMs: 1_786_147_200_000,
      eventUpperTimestamp: 1_786_147_200,
      latestSettledDayTimestamp: 1_786_060_800,
      eventCount: 1,
      coverageByChain: [{ chainId: 1, progressBlock: 23_000_000 }]
    },
    balance: {
      address: ADDRESS,
      denomination: 'usd',
      timeframe: '1y',
      isComplete: false,
      dataPoints: [{ date: '2026-08-07', value: 100, isComplete: false }]
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
        isComplete: false
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
    },
    growth: {
      address: ADDRESS,
      version: 'all',
      generatedAt: '2026-08-08T12:00:00.000Z',
      summary: {
        totalVaults: 1,
        completeVaults: 1,
        partialVaults: 0,
        historicalPpsRequirements: 0,
        historicalPpsCacheHits: 0,
        historicalPpsFetched: 0,
        historicalPpsMissing: 0,
        currentPpsFallbackVaults: 0,
        isComplete: true
      },
      vaults: [
        {
          chainId: 1,
          vaultAddress: VAULT_ADDRESS,
          status: 'ok',
          issues: [],
          shares: '1000000',
          sharesFormatted: 1,
          pricePerShare: 1.2,
          currentUnderlying: 1.2,
          baselineUnderlying: 1,
          realizedBaselineUnderlying: 0,
          unrealizedBaselineUnderlying: 1,
          realizedGrowthUnderlying: 0,
          unrealizedGrowthUnderlying: 0.2,
          growthUnderlying: 0.2,
          growthPct: 20,
          baselineExposureUnderlyingYears: 0.5,
          annualizedProtocolReturnPct: 40,
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
            tokenAddress: '0x3333333333333333333333333333333333333333'
          }
        }
      ]
    }
  }
}

describe('portfolio ledger combined query helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds one wallet-scoped endpoint and invalidatable cache key without a snapshot', () => {
    const endpoint = buildPortfolioLedgerPortfolioEndpoint({
      address: ADDRESS,
      denomination: 'eth',
      timeframe: 'all'
    })

    expect(endpoint).toBe(
      `/api/holdings/ledger/portfolio?address=${ADDRESS}&version=all&denomination=eth&timeframe=all`
    )
    expect(getPortfolioLedgerPortfolioCacheKey(endpoint)).toEqual(['fetch', endpoint, 'portfolio-ledger-portfolio'])
  })

  it('validates the combined ledger metadata, history, protocol return, and growth contract', () => {
    const parsed = portfolioLedgerPortfolioResponseSchema.parse(createCombinedResponse())

    expect(parsed.ledger.coverageByChain).toEqual([{ chainId: 1, progressBlock: 23_000_000 }])
    expect(parsed.growth.vaults[0]?.growthPct).toBe(20)
  })

  it('only accepts cached data for the exact wallet and chart request', () => {
    const response = createCombinedResponse()
    const matches = (overrides?: Partial<Parameters<typeof doesPortfolioLedgerPortfolioResponseMatchRequest>[0]>) =>
      doesPortfolioLedgerPortfolioResponseMatchRequest({
        address: ADDRESS,
        denomination: 'usd',
        timeframe: '1y',
        version: 'all',
        response,
        ...overrides
      })

    expect(matches()).toBe(true)
    expect(matches({ address: VAULT_ADDRESS })).toBe(false)
    expect(matches({ denomination: 'eth' })).toBe(false)
    expect(matches({ timeframe: 'all' })).toBe(false)
    expect(matches({ version: 'v3' })).toBe(false)
  })

  it('exposes both chart shapes and adds the live balance point', () => {
    const liveSnapshot: TPortfolioLiveBalanceSnapshot = {
      date: '2026-08-08',
      totalUsd: 125,
      totalEth: 0.05,
      vaults: []
    }
    const result = transformPortfolioLedgerPortfolioResponse({
      rawData: createCombinedResponse(),
      denomination: 'usd',
      liveSnapshot
    })

    expect(result.balanceData).toEqual([
      { date: '2026-08-07', value: 100, isComplete: false },
      { date: '2026-08-08', value: 125, isComplete: true, isLive: true }
    ])
    expect(result.balanceIsComplete).toBe(false)
    expect(result.protocolReturnSummary?.isComplete).toBe(false)
    expect(result.protocolReturnData?.[0]).toMatchObject({ growthWeightUsd: 10, protocolReturnPct: 10 })
  })

  it('keeps cached data visible if a background revalidation fails', () => {
    const refreshError = new Error('refresh failed')

    expect(
      resolvePortfolioLedgerPortfolioQueryState({
        hasResponse: true,
        isLoading: false,
        isFetching: false,
        error: refreshError
      })
    ).toEqual({ isLoading: false, visibleError: null })
  })

  it('retries only synchronization contention and respects Retry-After', () => {
    const syncingError = Object.assign(new Error('syncing'), { status: 202, retryAfterMs: 2500 })
    const unavailableError = Object.assign(new Error('unavailable'), { status: 503 })

    expect(shouldRetryPortfolioLedgerPortfolio(0, syncingError)).toBe(true)
    expect(getPortfolioLedgerPortfolioRetryDelay(syncingError)).toBe(2500)
    expect(shouldRetryPortfolioLedgerPortfolio(0, unavailableError)).toBe(false)
  })

  it('turns an actual 202 response into a retryable error with Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { status: 'syncing', reasonCode: 'lock_busy' },
            { status: 202, headers: { 'Retry-After': '2' } }
          )
        )
    )

    const error = await fetchPortfolioLedgerPortfolio('/api/holdings/ledger/portfolio').catch(
      (requestError: Error) => requestError
    )

    if (!(error instanceof Error)) {
      throw new Error('Expected the 202 response to reject')
    }
    expect(error).toBeInstanceOf(PortfolioLedgerPortfolioError)
    expect(error).toMatchObject({ status: 202, retryAfterMs: 2000, reasonCode: 'lock_busy' })
    expect(shouldRetryPortfolioLedgerPortfolio(0, error)).toBe(true)
  })
})
