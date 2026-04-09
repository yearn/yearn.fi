'use client'

import { useEffect } from 'react'

type TPlausibleTrackOptions = {
  callback?: () => void
  props?: Record<string, string | number | boolean | null>
  revenue?: {
    currency: string
    amount: number
  }
}

type TPlausibleTrack = (eventName: string, options?: TPlausibleTrackOptions) => void

let isInitialized = false
let trackEvent: TPlausibleTrack = () => undefined

function normalizePlausibleOptions(options?: TPlausibleTrackOptions) {
  if (!options) {
    return {}
  }

  const normalizedProps = options.props
    ? Object.fromEntries(
        Object.entries(options.props)
          .filter(([, value]) => value !== null)
          .map(([key, value]) => [key, String(value)])
      )
    : undefined

  return {
    callback: options.callback,
    revenue: options.revenue,
    props: normalizedProps
  }
}

async function initializePlausible(): Promise<void> {
  if (isInitialized || typeof window === 'undefined') {
    return
  }

  const plausible = await import('@plausible-analytics/tracker')

  plausible.init({
    domain: 'yearn.fi',
    endpoint: '/proxy/plausible/api/event',
    captureOnLocalhost: process.env.NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST === 'true',
    autoCapturePageviews: true
  })

  trackEvent = (eventName, options) => {
    plausible.track(eventName, normalizePlausibleOptions(options))
  }
  isInitialized = true
}

export function usePlausible() {
  useEffect(() => {
    void initializePlausible()
  }, [])

  return trackEvent
}
