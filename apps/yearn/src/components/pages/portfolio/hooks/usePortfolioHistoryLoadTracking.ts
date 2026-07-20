import { usePlausible } from '@hooks/usePlausible'
import type { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { useEffect, useRef } from 'react'
import type { TPortfolioHistoryDenomination, TPortfolioHistoryTimeframe } from '../types/api'

type TPortfolioHistoryLoadEvent =
  | typeof PLAUSIBLE_EVENTS.PORTFOLIO_BALANCE_HISTORY_LOAD
  | typeof PLAUSIBLE_EVENTS.PORTFOLIO_PROTOCOL_RETURN_HISTORY_LOAD

type TPortfolioHistoryLoadStatus = 'success' | 'empty' | 'error'
type TPortfolioHistoryLoadDurationBucket = '<2s' | '2-5s' | '5-10s' | '10-30s' | '30-60s' | '60s+'
type TPortfolioHistoryLoadPointBucket = 'unknown' | '0' | '1-365' | '366-900' | '900+'

type TUsePortfolioHistoryLoadTrackingArgs = {
  eventName: TPortfolioHistoryLoadEvent
  loadKey: string | null | undefined
  timeframe: TPortfolioHistoryTimeframe
  denomination?: TPortfolioHistoryDenomination
  isLoading: boolean
  isEmpty: boolean
  error: unknown
  pointCount: number | null | undefined
}

function getNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export function getPortfolioHistoryLoadDurationBucket(durationMs: number): TPortfolioHistoryLoadDurationBucket {
  if (durationMs < 2000) return '<2s'
  if (durationMs < 5000) return '2-5s'
  if (durationMs < 10000) return '5-10s'
  if (durationMs < 30000) return '10-30s'
  if (durationMs < 60000) return '30-60s'
  return '60s+'
}

export function getPortfolioHistoryLoadPointBucket(
  pointCount: number | null | undefined
): TPortfolioHistoryLoadPointBucket {
  if (pointCount === null || pointCount === undefined) return 'unknown'
  if (pointCount <= 0) return '0'
  if (pointCount <= 365) return '1-365'
  if (pointCount <= 900) return '366-900'
  return '900+'
}

export function usePortfolioHistoryLoadTracking({
  eventName,
  loadKey,
  timeframe,
  denomination,
  isLoading,
  isEmpty,
  error,
  pointCount
}: TUsePortfolioHistoryLoadTrackingArgs): void {
  const trackEvent = usePlausible()
  const activeLoadKeyRef = useRef<string | null>(null)
  const activeStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!loadKey) {
      activeLoadKeyRef.current = null
      activeStartedAtRef.current = null
      return
    }

    if (activeLoadKeyRef.current !== loadKey) {
      activeLoadKeyRef.current = loadKey
      activeStartedAtRef.current = null
    }

    if (isLoading && activeStartedAtRef.current === null) {
      activeStartedAtRef.current = getNow()
    }
  }, [isLoading, loadKey])

  useEffect(() => {
    if (!loadKey || activeLoadKeyRef.current !== loadKey || activeStartedAtRef.current === null || isLoading) {
      return
    }

    const status: TPortfolioHistoryLoadStatus = isEmpty ? 'empty' : error ? 'error' : 'success'
    const durationMs = Math.max(0, getNow() - activeStartedAtRef.current)
    const props: Record<string, string> = {
      status,
      timeframe,
      durationBucket: getPortfolioHistoryLoadDurationBucket(durationMs),
      pointsBucket: getPortfolioHistoryLoadPointBucket(pointCount)
    }

    if (denomination) {
      props.denomination = denomination
    }

    trackEvent(eventName, { props })
    activeStartedAtRef.current = null
  }, [denomination, error, eventName, isEmpty, isLoading, loadKey, pointCount, timeframe, trackEvent])
}
