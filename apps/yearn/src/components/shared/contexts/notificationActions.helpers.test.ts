import {
  isCrossChainNotificationType,
  shouldSetNotificationFinishedAt
} from '@shared/contexts/notificationActions.helpers'
import { describe, expect, it } from 'vitest'

describe('notification action helpers', () => {
  it('recognizes both cross-chain transaction directions', () => {
    expect(isCrossChainNotificationType('crosschain zap')).toBe(true)
    expect(isCrossChainNotificationType('crosschain withdraw zap')).toBe(true)
    expect(isCrossChainNotificationType('zap')).toBe(false)
  })

  it('does not finish a notification while its bridge is pending', () => {
    expect(shouldSetNotificationFinishedAt({ id: 1, status: 'submitted', bridgeStatus: 'pending' })).toBe(false)
  })

  it('finishes failed source transactions', () => {
    expect(shouldSetNotificationFinishedAt({ id: 1, status: 'error' })).toBe(true)
  })
})
