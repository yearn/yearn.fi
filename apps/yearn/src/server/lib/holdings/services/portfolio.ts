import type { HoldingsHistoryDenomination, HoldingsHistoryTimeframe } from '@/server/lib/holdings/services/aggregator'
import { getHistoricalHoldingsChart } from '@/server/lib/holdings/services/aggregator'
import type {
  HoldingsEventFetchType,
  HoldingsEventPaginationMode,
  VaultVersion
} from '@/server/lib/holdings/services/graphql'
import type {
  HoldingsPnLSimpleHistoryResponse,
  HoldingsPortfolioGrowthResponse
} from '@/server/lib/holdings/services/pnlSimple'
import { getHoldingsProtocolReturnPortfolio } from '@/server/lib/holdings/services/pnlSimple'
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
  version: VaultVersion
  denomination: HoldingsHistoryDenomination
  timeframe: HoldingsHistoryTimeframe
  balance: HoldingsPortfolioBalanceResponse
  protocolReturn: HoldingsPnLSimpleHistoryResponse
  growth: HoldingsPortfolioGrowthResponse
}

export async function getHoldingsPortfolio(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  denomination: HoldingsHistoryDenomination = 'usd',
  timeframe: HoldingsHistoryTimeframe = '1y'
): Promise<HoldingsPortfolioResponse> {
  const settledContextState: { request?: Promise<TSettledAddressScopedContext> } = {}
  const getSettledContext = (): Promise<TSettledAddressScopedContext> => {
    if (settledContextState.request) {
      return settledContextState.request
    }

    const request = getSettledAddressScopedContext({
      userAddress,
      fetchType,
      paginationMode
    })
    settledContextState.request = request
    return request
  }
  const protocolReturnPortfolioPromise = getHoldingsProtocolReturnPortfolio(
    userAddress,
    version,
    fetchType,
    paginationMode,
    timeframe,
    undefined,
    undefined,
    getSettledContext
  )
  const loadCacheValidationVaults = (): Promise<Array<{ chainId: number; vaultAddress: string }>> =>
    protocolReturnPortfolioPromise.then((portfolio) =>
      portfolio.growth.vaults.map((vault) => ({
        chainId: vault.chainId,
        vaultAddress: vault.vaultAddress
      }))
    )
  const balancePromise = getHistoricalHoldingsChart(
    userAddress,
    version,
    fetchType,
    paginationMode,
    denomination,
    timeframe,
    undefined,
    getSettledContext,
    loadCacheValidationVaults
  )
  const [balance, protocolReturnPortfolio] = await Promise.all([balancePromise, protocolReturnPortfolioPromise])

  return {
    address: balance.address,
    version,
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
}
