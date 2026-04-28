import type { TNotification } from '@shared/types/notifications'
import { describe, expect, it } from 'vitest'
import { getAwaitingExecutionEntries } from './WalletPanel.helpers'

const baseNotification: TNotification = {
  id: 1,
  type: 'deposit',
  address: '0x0000000000000000000000000000000000000001',
  chainId: 747474,
  amount: '1 ETH',
  fromAddress: '0x0000000000000000000000000000000000000002',
  fromTokenName: 'ETH',
  status: 'submitted'
}

describe('getAwaitingExecutionEntries', () => {
  it('returns only notifications still awaiting Safe execution', () => {
    expect(
      getAwaitingExecutionEntries([
        { ...baseNotification, id: 1, awaitingExecution: true },
        { ...baseNotification, id: 2, awaitingExecution: false },
        { ...baseNotification, id: 3, status: 'pending', awaitingExecution: true },
        { ...baseNotification, id: 4, status: 'success', awaitingExecution: true }
      ])
    ).toEqual([{ ...baseNotification, id: 1, awaitingExecution: true }])
  })
})
