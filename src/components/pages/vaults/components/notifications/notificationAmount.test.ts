import { describe, expect, it } from 'vitest'
import { getNotificationReceiveLabel } from './notificationAmount'

describe('getNotificationReceiveLabel', () => {
  it('labels swap quotes by their amount semantics', () => {
    expect(getNotificationReceiveLabel({ type: 'swap', toAmountType: 'expected' })).toBe('Expected receive:')
    expect(getNotificationReceiveLabel({ type: 'crosschain swap', toAmountType: 'minimum' })).toBe('Minimum receive:')
  })

  it('preserves the existing receive label for other notification types', () => {
    expect(getNotificationReceiveLabel({ type: 'withdraw', toAmountType: undefined })).toBe('Receive:')
  })
})
