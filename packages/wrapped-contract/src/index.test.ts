import { wrappedSchema } from '@yearn/wrapped-contract'
import { describe, expect, it } from 'vitest'

describe('Wrapped external boundary', () => {
  it('rejects legacy payloads rather than silently interpreting unsafe raw integers', () => {
    expect(wrappedSchema.safeParse({ version: 1, cards: { openingShares: 10 ** 24 } }).success).toBe(false)
  })
})
