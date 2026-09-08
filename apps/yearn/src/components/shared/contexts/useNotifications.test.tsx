// @vitest-environment jsdom
import { useNotifications, WithNotifications } from '@shared/contexts/useNotifications'
import type { TNotification } from '@shared/types/notifications'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  address: '0x111',
  getAll: vi.fn(),
  getByID: vi.fn(),
  update: vi.fn(),
  add: vi.fn(),
  deleteByID: vi.fn()
}))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ address: mocks.address }) }))
vi.mock('use-indexeddb', () => ({ useIndexedDBStore: () => mocks }))
const pending: TNotification = { id: 1, type: 'deposit', address: '0x111', chainId: 1, amount: '1', status: 'pending' }
const wrapper = ({ children }: { children: ReactNode }) => (
  <WithNotifications>
    <>{children}</>
  </WithNotifications>
)

describe('notification indicator state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    vi.resetAllMocks()
    mocks.address = '0x111'
    mocks.getAll.mockResolvedValue([pending, { ...pending, id: 2, status: 'success', timeFinished: 100 }])
    mocks.getByID.mockResolvedValue(pending)
    mocks.update.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('derives activity after reload and retains it through metadata-only updates and deletion', async () => {
    const { result } = renderHook(useNotifications, { wrapper })
    await act(async () => undefined)
    expect(result.current.notificationStatus).toBe('pending')
    await act(async () => {
      await result.current.updateEntry({ blockNumber: 10n }, 1)
    })
    expect(result.current.notificationStatus).toBe('pending')
    await act(async () => {
      await result.current.deleteByID(1)
    })
    expect(result.current.notificationStatus).toBe('success')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000)
    })
    expect(result.current.notificationStatus).toBeNull()
  })

  it('hides the previous wallet immediately while the next wallet is still loading', async () => {
    const { result, rerender } = renderHook(useNotifications, { wrapper })
    await act(async () => undefined)
    expect(result.current.notificationStatus).toBe('pending')
    mocks.address = '0x222'
    mocks.getAll.mockReturnValue(new Promise(() => undefined))
    rerender()
    expect(result.current.cachedEntries).toEqual([])
    expect(result.current.notificationStatus).toBeNull()
  })
})
