// @vitest-environment jsdom
import { TransactionLifecycleContext } from '@shared/contexts/transactionLifecycleContext'
import { useNotifications, WithNotifications } from '@shared/contexts/useNotifications'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createTransactionLifecycle, type TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const wallet = vi.hoisted(() => ({ address: '0x1111111111111111111111111111111111111111' }))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => wallet }))
const record = {
  version: 1,
  id: 'one',
  flowId: 'flow',
  attemptId: 'attempt',
  stepId: 'deposit',
  intentKey: 'deposit',
  owner: wallet.address,
  original: { canonicalChainId: 1, executionChainId: 1, hash: `0x${'a'.repeat(64)}` },
  effective: { canonicalChainId: 1, executionChainId: 1, hash: `0x${'a'.repeat(64)}` },
  request: { chainId: 1, to: wallet.address, data: '0x', value: '1' },
  confirmations: 1,
  createdAt: Date.now(),
  revision: 0,
  refresh: 'idle',
  settlement: 'same-chain'
} as TTransactionRecord

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('shows canonical owner-scoped history without exposing a legacy writer', async () => {
  const service = createTransactionLifecycle({
    execution: () => ({ execute: vi.fn(), switchChain: vi.fn(), waitForReceipt: () => new Promise(() => undefined) }),
    executionChainId: (id) => id,
    wallet: () => ({}),
    persistence: { load: async () => [record], apply: async (item) => item }
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TransactionLifecycleContext.Provider value={service}>
      <WithNotifications>
        <div>{children}</div>
      </WithNotifications>
    </TransactionLifecycleContext.Provider>
  )
  const stop = service.connect()
  const { result, rerender } = renderHook(useNotifications, { wrapper })
  await act(async () => undefined)
  expect(result.current.cachedEntries).toHaveLength(1)
  expect(result.current.cachedEntries[0].lifecycleRecord?.id).toBe('one')
  expect(result.current).not.toHaveProperty('addNotification')
  expect(result.current).not.toHaveProperty('updateEntry')
  wallet.address = '0x2222222222222222222222222222222222222222'
  rerender()
  expect(result.current.cachedEntries).toEqual([])
  stop()
})
