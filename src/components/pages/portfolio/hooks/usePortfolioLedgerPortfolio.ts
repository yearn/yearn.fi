import { upsertLivePortfolioBalancePoint } from '@pages/portfolio/hooks/usePortfolioHistory.helpers'
import { usePortfolioHistoryLoadTracking } from '@pages/portfolio/hooks/usePortfolioHistoryLoadTracking'
import { mapPortfolioLedgerGrowthVaults } from '@pages/portfolio/hooks/usePortfolioLedgerGrowth'
import {
  portfolioLedgerPortfolioResponseSchema,
  type TPortfolioHistoryChartData,
  type TPortfolioHistoryDenomination,
  type TPortfolioHistoryTimeframe,
  type TPortfolioLedgerPortfolioResponse,
  type TPortfolioLiveBalanceSnapshot,
  type TPortfolioProtocolReturnHistoryChartData,
  type TPortfolioProtocolReturnHistoryFamilySeries,
  type TPortfolioProtocolReturnHistorySummary
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export const PORTFOLIO_LEDGER_PORTFOLIO_CACHE_DURATION = 25 * 60 * 1000
const PORTFOLIO_LEDGER_PORTFOLIO_GC_DURATION = 60 * 60 * 1000
const PORTFOLIO_LEDGER_PORTFOLIO_MAX_SYNC_RETRIES = 150
const PORTFOLIO_LEDGER_PORTFOLIO_REQUEST_TIMEOUT = 5 * 60 * 1000
const DEFAULT_SYNC_RETRY_DELAY_MS = 2000

type TPortfolioLedgerPortfolioVersion = TPortfolioLedgerPortfolioResponse['version']
type TPortfolioLedgerPortfolioErrorBody = {
  reasonCode?: unknown
}

export class PortfolioLedgerPortfolioError extends Error {
  readonly response: { status: number }
  readonly retryAfterMs: number | null
  readonly reasonCode: string | null
  readonly status: number

  constructor(message: string, options: { status: number; retryAfterMs?: number | null; reasonCode?: string | null }) {
    super(message)
    this.name = 'PortfolioLedgerPortfolioError'
    this.status = options.status
    this.response = { status: options.status }
    this.retryAfterMs = options.retryAfterMs ?? null
    this.reasonCode = options.reasonCode ?? null
  }
}

function getRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After')
  if (!retryAfter) {
    return null
  }

  const retryAfterSeconds = Number(retryAfter)
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000
  }

  const retryAtMs = Date.parse(retryAfter)
  return Number.isFinite(retryAtMs) ? Math.max(retryAtMs - Date.now(), 0) : null
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getReasonCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const reasonCode = (body as TPortfolioLedgerPortfolioErrorBody).reasonCode
  return typeof reasonCode === 'string' ? reasonCode : null
}

function getRequestErrorStatus(error: Error): number | undefined {
  const requestError = error as Error & { response?: { status?: number }; status?: number }
  return requestError.response?.status ?? requestError.status
}

export function buildPortfolioLedgerPortfolioEndpoint(args: {
  address: string
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryTimeframe
  version?: TPortfolioLedgerPortfolioVersion
}): string {
  const params = new URLSearchParams({
    address: args.address.toLowerCase(),
    version: args.version ?? 'all',
    denomination: args.denomination,
    timeframe: args.timeframe
  })
  return `/api/holdings/ledger/portfolio?${params}`
}

export function getPortfolioLedgerPortfolioCacheKey(endpoint: string) {
  return ['fetch', endpoint, 'portfolio-ledger-portfolio'] as const
}

export function doesPortfolioLedgerPortfolioResponseMatchRequest(args: {
  address: string | undefined
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryTimeframe
  version: TPortfolioLedgerPortfolioVersion
  response: TPortfolioLedgerPortfolioResponse | undefined
}): boolean {
  return Boolean(
    args.address &&
      args.response &&
      args.response.address.toLowerCase() === args.address.toLowerCase() &&
      args.response.denomination === args.denomination &&
      args.response.timeframe === args.timeframe &&
      args.response.version === args.version
  )
}

export function shouldRetryPortfolioLedgerPortfolio(failureCount: number, error: Error): boolean {
  return getRequestErrorStatus(error) === 202 && failureCount < PORTFOLIO_LEDGER_PORTFOLIO_MAX_SYNC_RETRIES
}

export function getPortfolioLedgerPortfolioRetryDelay(error: Error): number {
  return (error as Error & { retryAfterMs?: number | null }).retryAfterMs ?? DEFAULT_SYNC_RETRY_DELAY_MS
}

export async function fetchPortfolioLedgerPortfolio(
  endpoint: string,
  signal?: AbortSignal
): Promise<TPortfolioLedgerPortfolioResponse> {
  const controller = new AbortController()
  const abortRequest = (): void => controller.abort()
  const timeoutId = setTimeout(abortRequest, PORTFOLIO_LEDGER_PORTFOLIO_REQUEST_TIMEOUT)

  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', abortRequest, { once: true })
  }

  try {
    const response = await globalThis.fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    const body = await readResponseBody(response)
    const errorOptions = {
      status: response.status,
      retryAfterMs: getRetryAfterMs(response),
      reasonCode: getReasonCode(body)
    }

    if (response.status === 202) {
      throw new PortfolioLedgerPortfolioError('Holdings ledger synchronization is still running', errorOptions)
    }
    if (!response.ok) {
      throw new PortfolioLedgerPortfolioError(
        `Holdings ledger portfolio request failed (${response.status})`,
        errorOptions
      )
    }

    const parsed = portfolioLedgerPortfolioResponseSchema.safeParse(body)
    if (!parsed.success) {
      throw new PortfolioLedgerPortfolioError('Holdings ledger portfolio schema validation failed', errorOptions)
    }

    return parsed.data
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortRequest)
  }
}

export function resolvePortfolioLedgerPortfolioQueryState(args: {
  hasResponse: boolean
  isLoading: boolean
  isFetching: boolean
  error: Error | null
}): { isLoading: boolean; visibleError: Error | null } {
  return {
    isLoading: !args.hasResponse && (args.isLoading || args.isFetching),
    visibleError: args.hasResponse ? null : args.error
  }
}

export function transformPortfolioLedgerPortfolioResponse(args: {
  rawData: TPortfolioLedgerPortfolioResponse | undefined
  denomination: TPortfolioHistoryDenomination
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null
}): {
  balanceData: TPortfolioHistoryChartData | null
  balanceIsComplete: boolean
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
  protocolReturnSummary: TPortfolioProtocolReturnHistorySummary | null
  protocolReturnFamilySeries: TPortfolioProtocolReturnHistoryFamilySeries
} {
  const balanceData = args.rawData?.balance.dataPoints
    ? upsertLivePortfolioBalancePoint({
        data: args.rawData.balance.dataPoints.map((point) => ({
          date: point.date,
          value: point.value,
          isComplete: point.isComplete
        })),
        denomination: args.denomination,
        liveSnapshot: args.liveSnapshot
      })
    : null
  const protocolReturnData = args.rawData?.protocolReturn.dataPoints
    ? args.rawData.protocolReturn.dataPoints.map((point) => ({
        date: point.date,
        growthWeightUsd: point.growthWeightUsd,
        growthWeightEth: point.growthWeightEth,
        protocolReturnPct: point.protocolReturnPct,
        annualizedProtocolReturnPct: point.annualizedProtocolReturnPct,
        growthIndex: point.growthIndex
      }))
    : null

  return {
    balanceData,
    balanceIsComplete: args.rawData?.balance.isComplete ?? true,
    protocolReturnData,
    protocolReturnSummary: args.rawData?.protocolReturn.summary ?? null,
    protocolReturnFamilySeries: args.rawData?.protocolReturn.familySeries ?? []
  }
}

export function usePortfolioLedgerPortfolio(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null,
  version: TPortfolioLedgerPortfolioVersion = 'all'
) {
  const { address } = useWeb3()
  const endpoint = useMemo(
    () => (address ? buildPortfolioLedgerPortfolioEndpoint({ address, denomination, timeframe, version }) : null),
    [address, denomination, timeframe, version]
  )
  const queryKey = useMemo(
    () =>
      endpoint
        ? getPortfolioLedgerPortfolioCacheKey(endpoint)
        : (['fetch', 'portfolio-ledger-portfolio-disabled'] as const),
    [endpoint]
  )
  const {
    data: rawData,
    isFetching,
    isLoading,
    isPlaceholderData,
    error
  } = useQuery<TPortfolioLedgerPortfolioResponse, Error>({
    queryKey,
    enabled: Boolean(endpoint) && Boolean(address) && enabled,
    queryFn: ({ signal }) => fetchPortfolioLedgerPortfolio(endpoint as string, signal),
    staleTime: PORTFOLIO_LEDGER_PORTFOLIO_CACHE_DURATION,
    gcTime: PORTFOLIO_LEDGER_PORTFOLIO_GC_DURATION,
    placeholderData: keepPreviousData,
    refetchInterval: PORTFOLIO_LEDGER_PORTFOLIO_CACHE_DURATION,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: shouldRetryPortfolioLedgerPortfolio,
    retryDelay: (_failureCount, requestError) => getPortfolioLedgerPortfolioRetryDelay(requestError)
  })
  const responseMatchesRequest = doesPortfolioLedgerPortfolioResponseMatchRequest({
    address,
    denomination,
    timeframe,
    version,
    response: rawData
  })
  const response = responseMatchesRequest ? rawData : undefined
  const responseMismatchError = useMemo(
    () =>
      rawData && address && !responseMatchesRequest && !isPlaceholderData
        ? new Error('Holdings ledger portfolio response does not match the request')
        : null,
    [address, isPlaceholderData, rawData, responseMatchesRequest]
  )
  const requestError = responseMismatchError ?? error
  const hasResponse = Boolean(response)
  const queryState = resolvePortfolioLedgerPortfolioQueryState({
    hasResponse,
    isLoading,
    isFetching,
    error: requestError
  })
  const { balanceData, balanceIsComplete, protocolReturnData, protocolReturnSummary, protocolReturnFamilySeries } =
    useMemo(
      () => transformPortfolioLedgerPortfolioResponse({ rawData: response, denomination, liveSnapshot }),
      [denomination, liveSnapshot, response]
    )
  const growthData = response?.growth ?? null
  const growthVaults = useMemo(() => growthData?.vaults ?? [], [growthData?.vaults])
  const growthVaultsByKey = useMemo(() => mapPortfolioLedgerGrowthVaults(growthVaults), [growthVaults])
  const errorStatus = requestError ? getRequestErrorStatus(requestError) : undefined
  const balanceIsEmpty =
    !queryState.isLoading &&
    Boolean(address) &&
    (errorStatus === 404 || Boolean(balanceData && balanceData.length === 0))
  const protocolReturnIsEmpty =
    !queryState.isLoading &&
    Boolean(address) &&
    (errorStatus === 404 || Boolean(protocolReturnData && protocolReturnData.length === 0))
  const balanceError = balanceIsEmpty ? null : queryState.visibleError
  const protocolReturnError = protocolReturnIsEmpty ? null : queryState.visibleError

  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_BALANCE_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:balance` : null,
    timeframe,
    denomination,
    isLoading: queryState.isLoading,
    isEmpty: balanceIsEmpty,
    error: requestError,
    pointCount: response?.balance.dataPoints.length
  })
  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_PROTOCOL_RETURN_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:protocol-return` : null,
    timeframe,
    isLoading: queryState.isLoading,
    isEmpty: protocolReturnIsEmpty,
    error: requestError,
    pointCount: response?.protocolReturn.dataPoints.length
  })

  return {
    balance: {
      data: balanceData,
      denomination: response?.balance.denomination ?? denomination,
      timeframe: response?.balance.timeframe ?? timeframe,
      isComplete: balanceIsComplete,
      isLoading: queryState.isLoading,
      progress: null,
      error: balanceError,
      isEmpty: balanceIsEmpty
    },
    protocolReturn: {
      data: protocolReturnData,
      summary: protocolReturnSummary,
      familySeries: protocolReturnFamilySeries,
      timeframe: response?.protocolReturn.timeframe ?? timeframe,
      isLoading: queryState.isLoading,
      progress: null,
      error: protocolReturnError,
      isEmpty: protocolReturnIsEmpty
    },
    growth: {
      data: growthData,
      summary: growthData?.summary ?? null,
      vaults: growthVaults,
      vaultsByKey: growthVaultsByKey,
      isLoading: queryState.isLoading,
      error: queryState.visibleError,
      isEmpty:
        !queryState.isLoading &&
        !queryState.visibleError &&
        Boolean(address) &&
        enabled &&
        Boolean(response) &&
        growthVaults.length === 0
    },
    ledger: response?.ledger ?? null,
    hasResponse,
    requestError,
    rawData: response
  }
}
