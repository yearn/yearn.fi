import type { HoldingsHistoryDenomination, HoldingsHistoryTimeframe } from '@/server/lib/holdings/services/aggregator'
import { getHistoricalHoldingsChart } from '@/server/lib/holdings/services/aggregator'
import { withHoldingsProgressReporter } from '@/server/lib/holdings/services/debug'
import type {
  HoldingsPnLSimpleHistoryResponse,
  HoldingsPortfolioGrowthResponse
} from '@/server/lib/holdings/services/pnlSimple'
import { getHoldingsProtocolReturnPortfolio } from '@/server/lib/holdings/services/pnlSimple'
import { createHoldingsPortfolioProgressTracker } from '@/server/lib/holdings/services/portfolioProgress'
import {
  getSettledAddressScopedContext,
  type TSettledAddressScopedContext
} from '@/server/lib/holdings/services/settledHoldingsContext'

export interface HoldingsPortfolioBalanceResponse {
  address: string
  denomination: HoldingsHistoryDenomination
  timeframe: HoldingsHistoryTimeframe
  dataPoints: Array<{ date: string; value: number }>
}

export interface HoldingsPortfolioResponse {
  address: string
  version: 'all'
  denomination: HoldingsHistoryDenomination
  timeframe: HoldingsHistoryTimeframe
  balance: HoldingsPortfolioBalanceResponse
  protocolReturn: HoldingsPnLSimpleHistoryResponse
  growth: HoldingsPortfolioGrowthResponse
}

export async function getHoldingsPortfolio(
  userAddress: string,
  denomination: HoldingsHistoryDenomination = 'usd',
  timeframe: HoldingsHistoryTimeframe = '1y',
  progressId: string | null = null
): Promise<HoldingsPortfolioResponse> {
  const progressTracker = createHoldingsPortfolioProgressTracker(progressId)
  const settledContextState: { request?: Promise<TSettledAddressScopedContext> } = {}
  const getSettledContext = (): Promise<TSettledAddressScopedContext> => {
    if (settledContextState.request) {
      return settledContextState.request
    }

    const request = getSettledAddressScopedContext({ userAddress })
    settledContextState.request = request
    return request
  }
  const protocolReturnPortfolioPromise = withHoldingsProgressReporter(progressTracker.reportGrowthProgress, () =>
    getHoldingsProtocolReturnPortfolio(userAddress, timeframe, undefined, getSettledContext)
  ).then((portfolio) => {
    progressTracker.markGrowthComplete()
    return portfolio
  })
  const loadCacheValidationVaults = (): Promise<Array<{ chainId: number; vaultAddress: string }>> =>
    protocolReturnPortfolioPromise.then((portfolio) =>
      portfolio.growth.vaults.map((vault) => ({
        chainId: vault.chainId,
        vaultAddress: vault.vaultAddress
      }))
    )
  const balancePromise = withHoldingsProgressReporter(progressTracker.reportBalanceProgress, () =>
    getHistoricalHoldingsChart(
      userAddress,
      denomination,
      timeframe,
      undefined,
      getSettledContext,
      loadCacheValidationVaults
    )
  ).then((balance) => {
    progressTracker.markBalanceComplete()
    return balance
  })

  try {
    const [balance, protocolReturnPortfolio] = await Promise.all([balancePromise, protocolReturnPortfolioPromise])
    await progressTracker.finish()

    return {
      address: balance.address,
      version: 'all',
      denomination,
      timeframe,
      balance: {
        address: balance.address,
        denomination: balance.denomination,
        timeframe: balance.timeframe,
        dataPoints: balance.dataPoints.map((point) => ({
          date: point.date,
          value: point.value
        }))
      },
      protocolReturn: protocolReturnPortfolio.protocolReturn,
      growth: protocolReturnPortfolio.growth
    }
  } catch (error) {
    await progressTracker.abort()
    throw error
  }
}
