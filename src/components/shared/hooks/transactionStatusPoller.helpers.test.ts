import { describe, expect, it } from 'vitest'
import { shouldPollNotificationStatus } from './transactionStatusPoller.helpers'

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
