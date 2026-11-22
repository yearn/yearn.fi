// @vitest-environment jsdom
import { projectLifecycleNotification } from '@shared/contexts/transactionLifecycleProjection'
import { getNotificationLifecyclePresentation } from '@shared/utils/notificationLifecycle'
import { selectTransaction, type TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import { describe, expect, it } from 'vitest'

const hash = `0x${'a'.repeat(64)}` as const
const owner = '0x1111111111111111111111111111111111111111' as const
const reference = { hash, canonicalChainId: 8453, executionChainId: 12345 }
const record: TTransactionRecord = {
  version: 1,
  id: 'record',
  flowId: 'flow',
  attemptId: 'attempt',
  stepId: 'deposit',
  intentKey: 'deposit:10',
  owner,
  revision: 0,
  createdAt: 100_000,
  request: { chainId: 8453, to: owner, data: '0x1234', value: '0' },
  display: { type: 'deposit', amount: '10', fromAddress: owner, fromChainId: 8453, fromSymbol: 'USDC' },
  original: reference,
  effective: reference,
  settlement: 'same-chain',
  confirmations: 2,
  refresh: 'idle'
}
describe('canonical notification compatibility', () => {
  it('uses shared outcome and complete execution-network references', () => {
    const projection = projectLifecycleNotification(record)
    expect(projection.id).toBeUndefined()
    expect(projection).toMatchObject({ address: owner, createdAt: 100, status: selectTransaction(record).outcome })
    expect(getNotificationLifecyclePresentation(projection)).toMatchObject({
      transactionHash: hash,
      transactionChainId: 12345
    })
    const unknown = projectLifecycleNotification({ ...record, trackingError: 'RPC outage' })
    expect(getNotificationLifecyclePresentation(unknown)).toMatchObject({
      label: 'Checking confirmation',
      styleStatus: 'submitted'
    })
  })
})
