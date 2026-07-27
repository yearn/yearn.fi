import { beforeEach, describe, expect, it, vi } from 'vitest'

const appendHoldingsProgressLogMock = vi.fn()
const updateHoldingsProgressMock = vi.fn()

vi.mock('@/server/lib/holdings/services/progress', () => ({
  appendHoldingsProgressLog: appendHoldingsProgressLogMock,
  updateHoldingsProgress: updateHoldingsProgressMock
}))

describe('holdings debug context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appendHoldingsProgressLogMock.mockResolvedValue(undefined)
    updateHoldingsProgressMock.mockResolvedValue(undefined)
  })

  it('skips verbose progress logs unless debug is enabled', async () => {
    const { createHoldingsDebugContext, debugLog, withHoldingsDebugContext } = await import(
      '@/server/lib/holdings/services/debug'
    )
    const context = createHoldingsDebugContext('history', '0x0000000000000000000000000000000000000001', false, {
      progressId: 'portfolio:test'
    })

    await withHoldingsDebugContext(context, async () => {
      debugLog('prices', 'fetched price batch')
    })

    expect(appendHoldingsProgressLogMock).not.toHaveBeenCalled()
  })

  it('flushes reported progress before leaving the request context', async () => {
    const pendingUpdate: { resolve?: () => void } = {}
    updateHoldingsProgressMock.mockReturnValue(
      new Promise<void>((resolve) => {
        pendingUpdate.resolve = resolve
      })
    )
    const { createHoldingsDebugContext, reportHoldingsProgress, withHoldingsDebugContext } = await import(
      '@/server/lib/holdings/services/debug'
    )
    const context = createHoldingsDebugContext(
      'protocol-return-history',
      '0x0000000000000000000000000000000000000001',
      false,
      { progressId: 'portfolio:test' }
    )
    const request = withHoldingsDebugContext(context, async () => {
      reportHoldingsProgress(92, 'Built historical chart series')
      return 'done'
    })
    const requestState = { settled: false }
    void request.finally(() => {
      requestState.settled = true
    })

    await vi.waitFor(() => expect(updateHoldingsProgressMock).toHaveBeenCalledTimes(1))
    expect(requestState.settled).toBe(false)
    pendingUpdate.resolve?.()

    await expect(request).resolves.toBe('done')
    expect(requestState.settled).toBe(true)
  })
})
