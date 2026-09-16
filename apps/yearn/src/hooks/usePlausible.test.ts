// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tracker = vi.hoisted(() => ({ init: vi.fn(), track: vi.fn() }))
vi.mock('@plausible-analytics/tracker', () => tracker)

describe('Plausible site configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST', '')
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it.each([
    [undefined, 'yearn.fi'],
    ['', 'yearn.fi'],
    ['   ', 'yearn.fi'],
    [
      ' yearnfi-git-codex-rainbow-wallet-ui-plausbile-yearn.vercel.app ',
      'yearnfi-git-codex-rainbow-wallet-ui-plausbile-yearn.vercel.app'
    ]
  ])('uses the configured site %s and initializes only once', async (configured, expected) => {
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', configured)
    const { initializePlausible, usePlausible } = await import('@hooks/usePlausible')
    initializePlausible()
    initializePlausible()
    const { result } = renderHook(usePlausible)
    result.current('wallet_picker_open', { props: { app: 'yearn' } })

    await waitFor(() => expect(tracker.track).toHaveBeenCalledOnce())
    expect(tracker.init).toHaveBeenCalledExactlyOnceWith({
      domain: expected,
      endpoint: '/proxy/plausible/api/event',
      captureOnLocalhost: false,
      autoCapturePageviews: true
    })
    expect(tracker.track).toHaveBeenCalledWith('wallet_picker_open', { props: { app: 'yearn' } })
  })
})
