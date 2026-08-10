import { describe, expect, it } from 'vitest'
import {
  shouldPollNotificationStatus,
  shouldRefreshBeforeNotificationSettlement
} from './transactionStatusPoller.helpers'

describe('shouldPollNotificationStatus', () => {
  it('polls normal pending notifications with a tx hash', () => {
    expect(
      shouldPollNotificationStatus({
        id: 1,
        status: 'pending',
        txHash: '0xabc',
        awaitingExecution: false
      })
    ).toBe(true)
  })

  it('polls submitted notifications that are still awaiting Safe execution', () => {
    expect(
      shouldPollNotificationStatus({
        id: 1,
        status: 'submitted',
        txHash: '0xabc',
        awaitingExecution: true
      })
    ).toBe(true)
  })

  it('does not poll submitted notifications that are already terminal', () => {
    expect(
      shouldPollNotificationStatus({
        id: 1,
        status: 'submitted',
        txHash: '0xabc',
        awaitingExecution: false
      })
    ).toBe(false)
  })
})

describe('shouldRefreshBeforeNotificationSettlement', () => {
  it('refreshes before settling a successful Safe execution notification', () => {
    expect(
      shouldRefreshBeforeNotificationSettlement({
        currentStatus: 'submitted',
        awaitingExecution: true,
        nextStatus: 'success'
      })
    ).toBe(true)
  })

  it('does not pre-refresh failed Safe execution notifications', () => {
    expect(
      shouldRefreshBeforeNotificationSettlement({
        currentStatus: 'submitted',
        awaitingExecution: true,
        nextStatus: 'error'
      })
    ).toBe(false)
  })

  it('does not pre-refresh ordinary pending notifications', () => {
    expect(
      shouldRefreshBeforeNotificationSettlement({
        currentStatus: 'pending',
        awaitingExecution: false,
        nextStatus: 'success'
      })
    ).toBe(false)
  })
})
