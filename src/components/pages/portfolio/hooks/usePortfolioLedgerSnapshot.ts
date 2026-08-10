import {
  portfolioLedgerSnapshotResponseSchema,
  type TPortfolioLedgerSnapshotResponse
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

const PORTFOLIO_LEDGER_SNAPSHOT_ENDPOINT = '/api/holdings/ledger/snapshot'
export const PORTFOLIO_LEDGER_SNAPSHOT_CACHE_DURATION = 25 * 60 * 1000
const PORTFOLIO_LEDGER_SNAPSHOT_MAX_SYNC_RETRIES = 150
const DEFAULT_SYNC_RETRY_DELAY_MS = 2000

type TPortfolioLedgerErrorBody = {
  reasonCode?: unknown
}

export class PortfolioLedgerSnapshotError extends Error {
  readonly status: number
  readonly retryAfterMs: number | null
  readonly reasonCode: string | null

  constructor(message: string, options: { status: number; retryAfterMs?: number | null; reasonCode?: string | null }) {
    super(message)
    this.name = 'PortfolioLedgerSnapshotError'
    this.status = options.status
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

  const reasonCode = (body as TPortfolioLedgerErrorBody).reasonCode
  return typeof reasonCode === 'string' ? reasonCode : null
}

export function getPortfolioLedgerSnapshotQueryKey(address: string) {
  const normalizedAddress = address.toLowerCase()
  const walletEndpoint = `${PORTFOLIO_LEDGER_SNAPSHOT_ENDPOINT}?address=${encodeURIComponent(normalizedAddress)}`
  return ['fetch', walletEndpoint, 'portfolio-ledger-snapshot'] as const
}

export function shouldRetryPortfolioLedgerSnapshot(failureCount: number, error: Error): boolean {
  return (
    error instanceof PortfolioLedgerSnapshotError &&
    error.status === 202 &&
    failureCount < PORTFOLIO_LEDGER_SNAPSHOT_MAX_SYNC_RETRIES
  )
}

export function getPortfolioLedgerSnapshotRetryDelay(error: Error): number {
  return error instanceof PortfolioLedgerSnapshotError
    ? (error.retryAfterMs ?? DEFAULT_SYNC_RETRY_DELAY_MS)
    : DEFAULT_SYNC_RETRY_DELAY_MS
}

export async function fetchPortfolioLedgerSnapshot(
  address: string,
  signal?: AbortSignal
): Promise<TPortfolioLedgerSnapshotResponse> {
  const response = await globalThis.fetch(PORTFOLIO_LEDGER_SNAPSHOT_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ address }),
    signal
  })
  const body = await readResponseBody(response)

  if (response.status === 202) {
    throw new PortfolioLedgerSnapshotError('Holdings ledger synchronization is still running', {
      status: response.status,
      retryAfterMs: getRetryAfterMs(response),
      reasonCode: getReasonCode(body)
    })
  }

  if (!response.ok) {
    throw new PortfolioLedgerSnapshotError(`Holdings ledger snapshot request failed (${response.status})`, {
      status: response.status,
      retryAfterMs: getRetryAfterMs(response),
      reasonCode: getReasonCode(body)
    })
  }

  const parsed = portfolioLedgerSnapshotResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new PortfolioLedgerSnapshotError('Holdings ledger snapshot schema validation failed', {
      status: response.status
    })
  }

  return parsed.data
}

export function usePortfolioLedgerSnapshot(enabled = true) {
  const { address } = useWeb3()
  const queryKey = useMemo(
    () => (address ? getPortfolioLedgerSnapshotQueryKey(address) : ['fetch', 'portfolio-ledger-snapshot-disabled']),
    [address]
  )

  const query = useQuery<TPortfolioLedgerSnapshotResponse, Error>({
    queryKey,
    enabled: Boolean(address) && enabled,
    queryFn: ({ signal }) => fetchPortfolioLedgerSnapshot(address as string, signal),
    staleTime: PORTFOLIO_LEDGER_SNAPSHOT_CACHE_DURATION,
    gcTime: PORTFOLIO_LEDGER_SNAPSHOT_CACHE_DURATION,
    refetchInterval: PORTFOLIO_LEDGER_SNAPSHOT_CACHE_DURATION,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: shouldRetryPortfolioLedgerSnapshot,
    retryDelay: (_failureCount, error) => getPortfolioLedgerSnapshotRetryDelay(error)
  })

  return {
    ...query,
    snapshotId: query.data?.snapshotId ?? null
  }
}
