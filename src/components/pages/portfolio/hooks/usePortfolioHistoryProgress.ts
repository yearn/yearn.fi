import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { portfolioHistoryProgressResponseSchema, type TPortfolioHistoryProgressResponse } from '../types/api'

export type TPortfolioHistoryProgress = Pick<
  TPortfolioHistoryProgressResponse,
  'status' | 'progress' | 'message' | 'detail'
>

function getLatestLogDetail(progress: TPortfolioHistoryProgressResponse): string | null {
  const latestLog = progress.logs.at(-1)
  if (!latestLog) {
    return null
  }

  return latestLog.message
}

export function createPortfolioHistoryProgressId(parts: string[]): string {
  const randomValue =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return [...parts, randomValue]
    .join(':')
    .replace(/[^a-zA-Z0-9:_-]/g, '-')
    .slice(0, 160)
}

export function usePortfolioHistoryProgress(
  progressId: string | null,
  address: string | null | undefined,
  route: 'history' | 'pnl-simple-history',
  enabled: boolean
): TPortfolioHistoryProgress | null {
  const endpoint = useMemo(
    () =>
      progressId && address
        ? `/api/holdings/progress?id=${encodeURIComponent(progressId)}&address=${encodeURIComponent(address)}&route=${encodeURIComponent(route)}`
        : null,
    [address, progressId, route]
  )

  const query = useQuery<TPortfolioHistoryProgressResponse | null>({
    queryKey: ['portfolio-history-progress', progressId, address?.toLowerCase(), route],
    enabled: Boolean(endpoint) && enabled,
    queryFn: async () => {
      const response = await globalThis.fetch(endpoint as string, { headers: { Accept: 'application/json' } })
      if (response.status === 404) {
        return null
      }
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      const parsed = portfolioHistoryProgressResponseSchema.safeParse(data)
      if (!parsed.success) {
        throw new Error('Progress schema validation failed')
      }
      return parsed.data
    },
    refetchInterval: enabled ? 1000 : false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0
  })

  return query.data
    ? {
        status: query.data.status,
        progress: query.data.progress,
        message: query.data.message,
        detail: query.data.detail ?? getLatestLogDetail(query.data)
      }
    : null
}
