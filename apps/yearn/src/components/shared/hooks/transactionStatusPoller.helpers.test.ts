import type { Hash, TransactionReceipt } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  resolvePolledTransactionStatus,
  shouldApplyPolledTransactionSettlement,
  shouldPollNotificationStatus,
  shouldRefreshBeforeNotificationSettlement
} from './transactionStatusPoller.helpers'

const submittedHash = `0x${'1'.repeat(64)}` as Hash
const replacementHash = `0x${'2'.repeat(64)}` as Hash
const successfulReceipt = { status: 'success', transactionHash: submittedHash } as TransactionReceipt

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

describe('resolvePolledTransactionStatus', () => {
  it('settles successful and reverted receipts under the requested hash', () => {
    expect(resolvePolledTransactionStatus({ receipt: successfulReceipt, requestedHash: submittedHash })).toBe('success')

    expect(
      resolvePolledTransactionStatus({
        receipt: { ...successfulReceipt, status: 'reverted' },
        requestedHash: submittedHash
      })
    ).toBe('error')
  })

  it('keeps a confirmed bridge source transaction submitted for destination tracking', () => {
    expect(
      resolvePolledTransactionStatus({
        receipt: successfulReceipt,
        requestedHash: submittedHash,
        isBridgeTransaction: true
      })
    ).toBe('submitted')
  })

  it('rejects a mismatched receipt without replacement evidence', () => {
    expect(() =>
      resolvePolledTransactionStatus({
        receipt: { ...successfulReceipt, transactionHash: replacementHash },
        requestedHash: submittedHash
      })
    ).toThrow('Transaction poller received a receipt for an unexpected transaction')
  })
})

describe('shouldApplyPolledTransactionSettlement', () => {
  it('only applies a result while the same hash remains pending', () => {
    expect(
      shouldApplyPolledTransactionSettlement(
        { id: 1, status: 'pending', txHash: submittedHash },
        { id: 1, txHash: submittedHash }
      )
    ).toBe(true)
    expect(
      shouldApplyPolledTransactionSettlement(
        { id: 1, status: 'success', txHash: submittedHash },
        { id: 1, txHash: submittedHash }
      )
    ).toBe(false)
    expect(
      shouldApplyPolledTransactionSettlement(
        { id: 1, status: 'pending', txHash: replacementHash },
        { id: 1, txHash: submittedHash }
      )
    ).toBe(false)
  })
})
