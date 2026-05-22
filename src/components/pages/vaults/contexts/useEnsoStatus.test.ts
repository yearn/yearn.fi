import { describe, expect, it } from 'vitest'
import { isEnsoStatusLive } from './useEnsoStatus'

describe('isEnsoStatusLive', () => {
  it('accepts only the public liveness response shape', () => {
    expect(isEnsoStatusLive({ status: 'ok' })).toBe(true)
    expect(isEnsoStatusLive({})).toBe(false)
    expect(isEnsoStatusLive({ configured: true } as { status?: string })).toBe(false)
  })
})
