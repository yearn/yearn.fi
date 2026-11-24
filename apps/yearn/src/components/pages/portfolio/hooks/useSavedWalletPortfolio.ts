import {
  portfolioBreakdownResponseSchema,
  portfolioBundleGrowthSchema,
  type TPortfolioHistoryDenomination,
  type TPortfolioHistoryTimeframe
} from '@pages/portfolio/types/api'
import { useQueries, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { coveredHoldingsHistorySchema } from '@/types/holdingsHistory'

const MAX_ACTIVE_REQUESTS = 3
const pending: Array<() => Promise<void>> = []
const active = { count: 0 }

function startNextRequest() {
  if (active.count >= MAX_ACTIVE_REQUESTS) return
  const run = pending.shift()
  if (!run) return
  active.count += 1
  void run().finally(() => {
    active.count -= 1
    startNextRequest()
  })
}

type TWalletRequest = RequestInit & { signal: AbortSignal }

async function requestWalletData(path: string, request: TWalletRequest): Promise<unknown> {
  const response = await fetch(`/api/holdings/${path}`, request)
  if (!response.ok) throw new Error('Wallet data is temporarily unavailable.')
  return response.json()
}

function fetchWalletData(path: string, request: TWalletRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    pending.push(async () => {
      try {
        request.signal.throwIfAborted()
        resolve(await requestWalletData(path, request))
      } catch (error) {
        reject(error)
      }
    })
    startNextRequest()
  })
}

function verifyAddress(data: { address: string }, requestedAddress: Address) {
  if (data.address.toLowerCase() !== requestedAddress)
    throw new Error('Wallet data did not match the requested address.')
}

export function useSavedWalletPortfolio(
  addresses: Address[],
  date: string,
  denomination: TPortfolioHistoryDenomination,
  timeframe: TPortfolioHistoryTimeframe
) {
  const positions = useQueries({
    queries: addresses.map((address) => ({
      queryKey: ['saved-wallet-positions', address, date],
      queryFn: async ({ signal }) => {
        // The latest breakdown reuses the same settled event snapshot as history.
        const data = portfolioBreakdownResponseSchema.parse(
          await fetchWalletData(`breakdown?${new URLSearchParams({ address })}`, { signal })
        )
        verifyAddress(data, address)
        if (data.date !== date) throw new Error('The latest settled positions are unavailable.')
        return data
      },
      staleTime: 5 * 60 * 1000,
      retry: false
    }))
  })
  const history = useQueries({
    queries: addresses.map((address) => ({
      queryKey: ['saved-wallet-history', address, date, denomination, timeframe],
      queryFn: async ({ signal }) => {
        const data = coveredHoldingsHistorySchema.parse(
          await fetchWalletData(`history?${new URLSearchParams({ address, coverage: '1', denomination, timeframe })}`, {
            signal
          })
        )
        verifyAddress(data, address)
        if (data.denomination !== denomination || data.timeframe !== timeframe)
          throw new Error('Wallet history did not match the requested series.')
        if (data.dataPoints.at(-1)?.date !== date) throw new Error('The latest settled balance history is unavailable.')
        return data
      },
      staleTime: 5 * 60 * 1000,
      retry: false
    }))
  })
  const growth = useSavedWalletGrowth(addresses, date, timeframe)
  return { positions, history, growth }
}

export function useSavedWalletGrowth(
  addresses: readonly Address[],
  date: string,
  timeframe: TPortfolioHistoryTimeframe,
  enabled = true
) {
  const members = addresses.toSorted()
  return useQuery({
    queryKey: ['saved-bundle-growth', members, date, timeframe],
    staleTime: 60 * 60 * 1000,
    retry: false,
    enabled: enabled && members.length > 0,
    queryFn: async ({ signal }) => {
      const fetchGrowth = members.length === 1 ? fetchWalletData : requestWalletData
      const data = portfolioBundleGrowthSchema.parse(
        await fetchGrowth('bundle-growth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: members, timeframe }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(5 * 60 * 1000)])
        })
      )
      const last = data.protocolReturn.dataPoints.at(-1)
      if (
        data.addresses.join(',') !== members.join(',') ||
        data.protocolReturn.timeframe !== timeframe ||
        (last && last.date !== date)
      ) {
        throw new Error('Bundle growth did not match the selected wallets or settled date.')
      }
      return data
    }
  })
}
