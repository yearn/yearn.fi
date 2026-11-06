// @vitest-environment jsdom
import { RecentActivity } from '@shared/components/RecentActivity'
import { projectLifecycleNotification } from '@shared/contexts/transactionLifecycleProjection'
import type { TNotification } from '@shared/types/notifications'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import type { TransactionReceipt } from 'viem'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ cachedEntries: [] as TNotification[] }))
vi.mock('@shared/contexts/useNotifications', () => ({ useNotifications: () => state }))
vi.mock('@hooks/useThemePreference', () => ({ useThemePreference: () => 'light' }))
afterEach(cleanup)
const owner = '0x1111111111111111111111111111111111111111'
const hash = `0x${'a'.repeat(64)}` as const
const record: TTransactionRecord = {
  version: 1,
  id: 'pending',
  flowId: 'flow',
  attemptId: 'attempt',
  stepId: 'deposit',
  intentKey: 'deposit',
  owner,
  revision: 0,
  createdAt: 1000,
  request: { chainId: 1, to: owner, data: '0x', value: '0' },
  display: { type: 'deposit', amount: '10', fromSymbol: 'USDC', fromAddress: owner, fromChainId: 1 },
  original: { hash, canonicalChainId: 1, executionChainId: 1 },
  effective: { hash, canonicalChainId: 1, executionChainId: 1 },
  settlement: 'same-chain',
  confirmations: 1,
  refresh: 'success'
}
it('keeps pending activity visible and replaces its spinner in the same row when it completes', () => {
  const onViewAll = vi.fn()
  const completed = { ...record, source: { receipt: { status: 'success' } as TransactionReceipt, observedAt: 2000 } }
  state.cachedEntries = [0, 1, 2].map((index) => projectLifecycleNotification({ ...completed, id: `done-${index}` }))
  state.cachedEntries.push(projectLifecycleNotification(record))
  const { rerender } = render(<RecentActivity onViewAll={onViewAll} />)
  const row = screen.getAllByRole('listitem')[0]
  expect(within(row).getByRole('status', { name: 'Transaction pending' })).toBeTruthy()
  expect(within(row).getByText('10 USDC')).toBeTruthy()
  state.cachedEntries = state.cachedEntries.map((entry) =>
    entry.lifecycleRecord?.id === record.id
      ? projectLifecycleNotification({ ...completed, source: { ...completed.source, observedAt: 3000 } })
      : entry
  )
  rerender(<RecentActivity onViewAll={onViewAll} />)
  expect(screen.getAllByRole('listitem')[0]).toBe(row)
  expect(within(row).queryByRole('status')).toBeNull()
  expect(within(row).getByText('Success')).toBeTruthy()
  expect(screen.getAllByText('10 USDC')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'View all activity' }))
  expect(onViewAll).toHaveBeenCalledOnce()
})
it('does not hide pending transactions behind the three-item history limit', () => {
  state.cachedEntries = [0, 1, 2, 3].map((index) => projectLifecycleNotification({ ...record, id: `pending-${index}` }))
  render(<RecentActivity onViewAll={() => undefined} />)
  expect(screen.getAllByRole('status')).toHaveLength(4)
})
