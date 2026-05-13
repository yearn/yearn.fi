import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPoolMock = vi.fn()
const isDatabaseEnabledMock = vi.fn()

vi.mock('../db/connection', () => ({
  getPool: getPoolMock,
  isDatabaseEnabled: isDatabaseEnabledMock
}))

const PROGRESS_ID = 'portfolio-history:0x0000000000000000000000000000000000000001:usd:1y'
const WALLET_ADDRESS = '0x0000000000000000000000000000000000000001'
const MISSING_PROGRESS_TABLE_ERROR = Object.assign(new Error('relation "holdings_progress" does not exist'), {
  code: '42P01'
})

function emptyQueryResult() {
  return { rows: [], rowCount: 0 }
}

describe('holdings progress persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isDatabaseEnabledMock.mockReturnValue(true)
  })

  it('initializes progress storage before reading progress rows', async () => {
    const state = { schemaInitialized: false }
    const queryMock = vi.fn(async (queryText: string) => {
      if (queryText.includes('CREATE TABLE IF NOT EXISTS holdings_progress')) {
        state.schemaInitialized = true
        return emptyQueryResult()
      }

      if (!state.schemaInitialized && queryText.includes('holdings_progress')) {
        throw MISSING_PROGRESS_TABLE_ERROR
      }

      if (queryText.includes('SELECT id, route, address, status, progress')) {
        return {
          rows: [
            {
              id: PROGRESS_ID,
              route: 'history',
              address: WALLET_ADDRESS,
              status: 'running',
              progress: 42,
              message: 'Loading portfolio history',
              detail: null,
              started_at: new Date('2026-05-13T00:00:00Z'),
              updated_at: new Date('2026-05-13T00:00:01Z'),
              logs: []
            }
          ],
          rowCount: 1
        }
      }

      return emptyQueryResult()
    })
    getPoolMock.mockResolvedValue({ query: queryMock, end: vi.fn() })

    const { getHoldingsProgress } = await import('./progress')
    const result = await getHoldingsProgress(PROGRESS_ID)

    expect(result?.progress).toBe(42)
    expect(result?.message).toBe('Loading portfolio history')
    expect(queryMock.mock.calls[0]?.[0]).toContain('CREATE TABLE IF NOT EXISTS holdings_progress')
  })

  it('treats a missing progress table as non-fatal when polling progress', async () => {
    const queryMock = vi.fn(async (queryText: string) => {
      if (queryText.includes('CREATE TABLE IF NOT EXISTS holdings_progress')) {
        return emptyQueryResult()
      }

      if (queryText.includes('holdings_progress')) {
        throw MISSING_PROGRESS_TABLE_ERROR
      }

      return emptyQueryResult()
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    getPoolMock.mockResolvedValue({ query: queryMock, end: vi.fn() })

    const { getHoldingsProgress } = await import('./progress')
    const result = await getHoldingsProgress(PROGRESS_ID)

    expect(result).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('holdings_progress table is unavailable'))

    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })
})
