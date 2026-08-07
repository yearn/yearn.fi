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

  it('scopes a re-entrant debug opt-in to the nested call for the same wallet', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const {
      createHoldingsDebugContext,
      debugLog,
      getHoldingsDebugContext,
      getHoldingsDebugFilters,
      withHoldingsDebugContext
    } = await import('@/server/lib/holdings/services/debug')
    const address = '0x0000000000000000000000000000000000000001'
    const outerContext = createHoldingsDebugContext('history', address, false, {
      progressId: 'portfolio:outer'
    })
    const nestedContext = createHoldingsDebugContext('ledger-sync', address.toUpperCase(), true, {
      lotsEnabled: true,
      vaultFilter: '0x0000000000000000000000000000000000000002',
      txFilter: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      progressId: 'portfolio:ledger'
    })

    try {
      await withHoldingsDebugContext(outerContext, async () => {
        debugLog('ledger-sync', 'before nested opt-in')

        await withHoldingsDebugContext(nestedContext, async () => {
          expect(getHoldingsDebugContext()).not.toBe(outerContext)
          expect(getHoldingsDebugFilters()).toEqual({
            lotsEnabled: true,
            vaultFilter: '0x0000000000000000000000000000000000000002',
            txFilter: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          })
          debugLog('ledger-sync', 'nested ledger stage')
        })

        expect(getHoldingsDebugContext()).toBe(outerContext)
        expect(getHoldingsDebugFilters()).toEqual({
          lotsEnabled: false,
          vaultFilter: null,
          txFilter: null
        })
        debugLog('ledger-sync', 'after nested ledger stage')
      })

      const output = consoleLog.mock.calls.map(([message]) => String(message)).join('\n')
      expect(output).not.toContain('before nested opt-in')
      expect(output).toContain('nested ledger stage')
      expect(output).not.toContain('after nested ledger stage')
      expect(appendHoldingsProgressLogMock).toHaveBeenCalledTimes(1)
      expect(appendHoldingsProgressLogMock).toHaveBeenCalledWith(
        'portfolio:ledger',
        expect.objectContaining({ scope: 'ledger-sync', message: 'nested ledger stage' })
      )
      expect(getHoldingsDebugContext()).toBeUndefined()
    } finally {
      consoleLog.mockRestore()
    }
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
