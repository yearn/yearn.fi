import { hasUnfinishedLegacyBridge } from '@shared/contexts/legacyBridgeRecovery'
import type { TNotification } from '@shared/types/notifications'
import { describe, expect, it } from 'vitest'

const owner = '0x1111111111111111111111111111111111111111'
const record = {
  address: owner,
  amount: '10',
  type: 'crosschain zap',
  status: 'submitted',
  chainId: 1,
  toChainId: 10
} as TNotification
describe('legacy bridge migration guard', () => {
  it('blocks an unfinished or tracking-unavailable legacy bridge for the reviewed owner', () => {
    expect(hasUnfinishedLegacyBridge([record], owner)).toBe(true)
    expect(hasUnfinishedLegacyBridge([{ ...record, bridgeTrackingState: 'unavailable' }], owner)).toBe(true)
  })
  it('does not block another owner, same-chain actions, or settled legacy outcomes', () => {
    expect(hasUnfinishedLegacyBridge([record], '0x2222222222222222222222222222222222222222')).toBe(false)
    expect(hasUnfinishedLegacyBridge([{ ...record, type: 'deposit', toChainId: 1 }], owner)).toBe(false)
    expect(hasUnfinishedLegacyBridge([{ ...record, bridgeStatus: 'delivered', status: 'success' }], owner)).toBe(false)
    expect(hasUnfinishedLegacyBridge([{ ...record, status: 'error' }], owner)).toBe(false)
  })
})
