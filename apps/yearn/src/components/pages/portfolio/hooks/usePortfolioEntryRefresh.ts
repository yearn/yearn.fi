import { useEffect, useRef } from 'react'
import { shouldRequestPortfolioEntryRefresh } from './usePortfolioEntryRefresh.helpers'

export function usePortfolioEntryRefresh({
  isActive,
  onRefresh
}: {
  isActive: boolean
  onRefresh: () => Promise<unknown>
}) {
  const hasRequestedRefreshRef = useRef(false)

  useEffect(() => {
    if (!shouldRequestPortfolioEntryRefresh({ isActive, hasRequestedRefresh: hasRequestedRefreshRef.current })) {
      return
    }

    hasRequestedRefreshRef.current = true
    // Portfolio freshness depends on an imperative wallet refresh when the route becomes active.
    void onRefresh().catch(() => undefined)
  }, [isActive, onRefresh])
}
