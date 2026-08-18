import {
  fetchPortfolioLedgerSnapshot,
  getPortfolioLedgerSnapshotQueryKey,
  getPortfolioLedgerSnapshotRetryDelay,
  PortfolioLedgerSnapshotError,
  shouldRetryPortfolioLedgerSnapshot
} from '@pages/portfolio/hooks/usePortfolioLedgerSnapshot'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SNAPSHOT_ID = `snapshot_${'a'.repeat(32)}`

function createReadySnapshot() {
  return {
    status: 'ready',
    snapshotId: SNAPSHOT_ID,
    revision: 'revision-1',
    sourceGeneration: 2,
    headSource: 'active',
    freshness: 'refreshed',
    latestSettledDayTimestamp: 1_786_060_800,
    eventUpperTimestamp: 1_786_147_200,
    expiresAtMs: 1_786_149_000_000
  }
}

describe('portfolio ledger snapshot request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the wallet address and validates the ready snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(createReadySnapshot(), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPortfolioLedgerSnapshot(ADDRESS)).resolves.toMatchObject({ snapshotId: SNAPSHOT_ID })
    expect(fetchMock).toHaveBeenCalledWith('/api/holdings/ledger/snapshot', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address: ADDRESS }),
      signal: undefined
    })
  })

  it('turns a syncing response into a retryable error using Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { status: 'syncing', reasonCode: 'lock_busy' },
            { status: 202, headers: { 'Retry-After': '2' } }
          )
        )
    )

    const request = fetchPortfolioLedgerSnapshot(ADDRESS)

    await expect(request).rejects.toMatchObject({ status: 202, retryAfterMs: 2000, reasonCode: 'lock_busy' })
  })

  it('only retries 202 synchronization responses and lets 404/503 fall back', () => {
    const syncing = new PortfolioLedgerSnapshotError('syncing', { status: 202, retryAfterMs: 2500 })
    const empty = new PortfolioLedgerSnapshotError('empty', { status: 404 })
    const unavailable = new PortfolioLedgerSnapshotError('unavailable', { status: 503 })

    expect(shouldRetryPortfolioLedgerSnapshot(0, syncing)).toBe(true)
    expect(getPortfolioLedgerSnapshotRetryDelay(syncing)).toBe(2500)
    expect(shouldRetryPortfolioLedgerSnapshot(0, empty)).toBe(false)
    expect(shouldRetryPortfolioLedgerSnapshot(0, unavailable)).toBe(false)
  })

  it('uses a wallet-scoped invalidatable query key', () => {
    expect(getPortfolioLedgerSnapshotQueryKey(ADDRESS)).toEqual([
      'fetch',
      `/api/holdings/ledger/snapshot?address=${ADDRESS}`,
      'portfolio-ledger-snapshot'
    ])
  })
})
