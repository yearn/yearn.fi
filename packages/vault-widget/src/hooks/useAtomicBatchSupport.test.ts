import { supportsAtomicBatch } from '@yearn/vault-widget/internal/hooks/useAtomicBatchSupport'
import { describe, expect, it } from 'vitest'

describe('supportsAtomicBatch', () => {
  it.each(['supported', 'ready'])('accepts the %s atomic capability', (status) => {
    expect(supportsAtomicBatch({ atomic: { status } })).toBe(true)
  })

  it.each([{ atomic: { status: 'unsupported' } }, { atomic: {} }, {}, undefined])(
    'rejects missing or unsupported atomic capabilities',
    (capabilities) => {
      expect(supportsAtomicBatch(capabilities)).toBe(false)
    }
  )
})
