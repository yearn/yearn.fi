import { describe, expect, it } from 'vitest'
import { ENSO_BALANCES_CACHE_CONTROL } from './cache'

describe('ENSO_BALANCES_CACHE_CONTROL', () => {
  it('disables intermediary and browser caching for wallet balance responses', () => {
    expect(ENSO_BALANCES_CACHE_CONTROL).toBe('private, no-store, max-age=0, must-revalidate')
  })
})
