// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tracker = vi.hoisted(() => ({ init: vi.fn(), track: vi.fn() }))
vi.mock('@plausible-analytics/tracker', () => tracker)

describe('yBOLD analytics adapter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', '')
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST', '')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('initializes once and queues events with the app dimension while loading', async () => {
    const { initializeAnalytics, trackAnalytics } = await import('@ybold/lib/analytics')
    trackAnalytics('wallet_picker_open', { entry_point: 'header' })
    trackAnalytics('widget_flow_started', { route: 'ybold_zap_in' })
    await initializeAnalytics()
    expect(tracker.init).toHaveBeenCalledExactlyOnceWith({
      domain: 'yearn.fi',
      endpoint: '/proxy/plausible/api/event',
      captureOnLocalhost: false,
      autoCapturePageviews: true
    })
    expect(tracker.track.mock.calls).toEqual([
      ['wallet_picker_open', { props: { entry_point: 'header', app: 'ybold' } }],
      ['widget_flow_started', { props: { route: 'ybold_zap_in', app: 'ybold' } }]
    ])
  })

  it('allows an explicit site and local QA without enabling local tracking by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'ybold.example')
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST', 'true')
    const { initializeAnalytics } = await import('@ybold/lib/analytics')
    await initializeAnalytics()
    expect(tracker.init).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'ybold.example',
        captureOnLocalhost: true
      })
    )
  })
})
