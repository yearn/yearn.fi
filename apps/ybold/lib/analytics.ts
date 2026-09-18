import type { TWalletAnalyticsProperties } from '@yearn/wallet-ui/analytics'

type TTracker = typeof import('@plausible-analytics/tracker')
const state: { ready?: Promise<TTracker> } = {}

export function initializeAnalytics(): Promise<TTracker> | undefined {
  if (typeof window === 'undefined') return undefined
  state.ready ??= import('@plausible-analytics/tracker').then((tracker) => {
    tracker.init({
      domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'yearn.fi',
      endpoint: '/proxy/plausible/api/event',
      captureOnLocalhost: process.env.NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST === 'true',
      autoCapturePageviews: true
    })
    return tracker
  })
  return state.ready
}

export function trackAnalytics(event: string, props: TWalletAnalyticsProperties): void {
  void initializeAnalytics()
    ?.then(({ track }) => track(event, { props: { ...props, app: 'ybold' } }))
    .catch(() => undefined)
}
