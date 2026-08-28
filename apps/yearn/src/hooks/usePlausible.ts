import { useCallback, useEffect } from 'react'
import { env } from '@/env'

type TPlausibleTracker = typeof import('@plausible-analytics/tracker')
type TTrack = TPlausibleTracker['track']

let isInitialized = false
let trackEvent: TTrack | undefined
let initializationPromise: Promise<void> | undefined

export function initializePlausible(): void {
  if (isInitialized || initializationPromise || typeof window === 'undefined') {
    return
  }

  initializationPromise = import('@plausible-analytics/tracker').then(({ init, track }) => {
    trackEvent = track
    init({
      domain: 'yearn.fi',
      endpoint: '/proxy/plausible/api/event',
      captureOnLocalhost: env.NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST === 'true',
      autoCapturePageviews: true
    })
    isInitialized = true
  })
}

export function usePlausible() {
  useEffect(() => {
    initializePlausible()
  }, [])

  return useCallback((...args: Parameters<TTrack>): void => {
    initializePlausible()
    if (trackEvent) {
      trackEvent(...args)
      return
    }

    void initializationPromise?.then(() => trackEvent?.(...args))
  }, [])
}
