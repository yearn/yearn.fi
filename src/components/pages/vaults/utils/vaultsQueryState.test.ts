import { describe, expect, it } from 'vitest'
import {
  buildSnapshotFromParams,
  buildUrlParamsFromSnapshot,
  DEFAULT_VAULT_QUERY_DEFAULTS,
  ensureDefaultSortParam
} from './vaultsQueryState'

describe('vaults sort query state', () => {
  it('uses TVL by default and writes it to the query', () => {
    const snapshot = buildSnapshotFromParams(new URLSearchParams(), DEFAULT_VAULT_QUERY_DEFAULTS)
    const params = buildUrlParamsFromSnapshot(snapshot, DEFAULT_VAULT_QUERY_DEFAULTS)

    expect(snapshot.sortBy).toBe('tvl')
    expect(snapshot.sortDirection).toBe('desc')
    expect(params.get('sortBy')).toBe('tvl')
    expect(params.has('sortDirection')).toBe(false)
  })

  it('keeps the internal unsorted state out of the query', () => {
    const snapshot = {
      ...buildSnapshotFromParams(new URLSearchParams(), DEFAULT_VAULT_QUERY_DEFAULTS),
      sortBy: 'none' as const,
      sortDirection: 'asc' as const
    }
    const params = buildUrlParamsFromSnapshot(snapshot, DEFAULT_VAULT_QUERY_DEFAULTS)

    expect(params.has('sortBy')).toBe(false)
    expect(params.has('sortDirection')).toBe(false)
  })

  it('normalizes a legacy sortBy=none query to the TVL descending default', () => {
    const snapshot = buildSnapshotFromParams(
      new URLSearchParams('sortBy=none&sortDirection=asc'),
      DEFAULT_VAULT_QUERY_DEFAULTS
    )

    expect(snapshot.sortBy).toBe('tvl')
    expect(snapshot.sortDirection).toBe('desc')
  })

  it('adds the default sort without dropping existing query params', () => {
    const params = ensureDefaultSortParam(new URLSearchParams('search=usdc&utm_source=test'), 'tvl')

    expect(params.toString()).toBe('search=usdc&utm_source=test&sortBy=tvl')
  })

  it('replaces a legacy unsorted query and its stale direction', () => {
    const params = ensureDefaultSortParam(new URLSearchParams('search=usdc&sortBy=none&sortDirection=asc'), 'tvl')

    expect(params.toString()).toBe('search=usdc&sortBy=tvl')
  })

  it('leaves an explicit public sort unchanged', () => {
    const params = ensureDefaultSortParam(new URLSearchParams('sortBy=estAPY&sortDirection=asc'), 'tvl')

    expect(params.toString()).toBe('sortBy=estAPY&sortDirection=asc')
  })
})
