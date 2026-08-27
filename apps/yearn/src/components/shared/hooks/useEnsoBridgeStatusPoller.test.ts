// @vitest-environment jsdom

import { useNotifications } from '@shared/contexts/useNotifications'
import { ENSO_BRIDGE_POLL_INTERVAL_MS, fetchEnsoBridgeStatus } from '@shared/hooks/ensoBridgeStatus'
import { useEnsoBridgeStatusPoller } from '@shared/hooks/useEnsoBridgeStatusPoller'
import { useNotificationAssetRefresh } from '@shared/hooks/useNotificationAssetRefresh'
import type { TNotification, TNotificationsContext } from '@shared/types/notifications'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/contexts/useNotifications', () => ({
  useNotifications: vi.fn()
}))

vi.mock('@shared/hooks/ensoBridgeStatus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/hooks/ensoBridgeStatus')>()),
  fetchEnsoBridgeStatus: vi.fn()
}))

vi.mock('@shared/hooks/useNotificationAssetRefresh', () => ({
  useNotificationAssetRefresh: vi.fn()
}))

const HASH = `0x${'a'.repeat(64)}` as const
const NOTIFICATION: TNotification = {
  id: 1,
  type: 'crosschain zap',
  address: '0x0000000000000000000000000000000000000001',
  chainId: 8453,
  toChainId: 747474,
  amount: '1',
  status: 'submitted',
  txHash: HASH,
  bridgeProtocol: 'relay',
  bridgeStatus: 'pending',
  bridgeTrackingState: 'active',
  sourceConfirmedAt: 10
}

const useNotificationsMock = vi.mocked(useNotifications)
const fetchEnsoBridgeStatusMock = vi.mocked(fetchEnsoBridgeStatus)
const useNotificationAssetRefreshMock = vi.mocked(useNotificationAssetRefresh)

function notificationsContext(updateEntry: TNotificationsContext['updateEntry']): TNotificationsContext {
  return {
    cachedEntries: [NOTIFICATION],
    notificationStatus: null,
    isLoading: false,
    error: null,
    setNotificationStatus: vi.fn(),
    deleteByID: vi.fn(),
    updateEntry,
    addNotification: vi.fn()
  }
}

describe('useEnsoBridgeStatusPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    fetchEnsoBridgeStatusMock.mockResolvedValue({ status: 'pending' })
    useNotificationAssetRefreshMock.mockReturnValue(vi.fn().mockResolvedValue(undefined))
    useNotificationsMock.mockReturnValue(notificationsContext(vi.fn().mockResolvedValue(undefined)))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('keeps polling on schedule when notification context callbacks change', async () => {
    const { rerender } = renderHook(() => useEnsoBridgeStatusPoller([NOTIFICATION]))
    await act(async () => undefined)
    expect(fetchEnsoBridgeStatusMock).toHaveBeenCalledTimes(1)

    useNotificationsMock.mockReturnValue(notificationsContext(vi.fn().mockResolvedValue(undefined)))
    rerender()
    await act(async () => undefined)
    expect(fetchEnsoBridgeStatusMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENSO_BRIDGE_POLL_INTERVAL_MS)
    })
    expect(fetchEnsoBridgeStatusMock).toHaveBeenCalledTimes(2)
  })
})
