import { describe, expect, it } from 'vitest'
import { parseUtcDateParam } from './breakdown'

describe('parseUtcDateParam', () => {
  it('parses valid UTC dates', () => {
    expect(parseUtcDateParam('2026-02-28')).toBe(Math.floor(Date.UTC(2026, 1, 28) / 1000))
  })

  it('rejects impossible calendar dates instead of normalizing them', () => {
    expect(parseUtcDateParam('2026-02-31')).toBeNull()
    expect(parseUtcDateParam('2026-13-01')).toBeNull()
    expect(parseUtcDateParam('2026-00-10')).toBeNull()
  })
})
