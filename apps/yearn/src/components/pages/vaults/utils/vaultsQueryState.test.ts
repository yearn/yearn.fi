import { describe, expect, it } from 'vitest'
import {
  buildSnapshotFromParams,
  buildUrlParamsFromSnapshot,
  DEFAULT_VAULT_QUERY_DEFAULTS,
  sanitizeInactiveSortParams
} from './vaultsQueryState'

describe('vaults sort query state', () => {
  it('uses the raw list by default and keeps sorting out of the query', () => {
    const snapshot = buildSnapshotFromParams(new URLSearchParams(), DEFAULT_VAULT_QUERY_DEFAULTS)
    const params = buildUrlParamsFromSnapshot(snapshot, DEFAULT_VAULT_QUERY_DEFAULTS)

    expect(snapshot.sortBy).toBe('none')
    expect(snapshot.sortDirection).toBe('desc')
    expect(params.has('sortBy')).toBe(false)
    expect(params.has('sortDirection')).toBe(false)
  })

  it('writes an active descending sort without the default direction', () => {
    const snapshot = {
      ...buildSnapshotFromParams(new URLSearchParams(), DEFAULT_VAULT_QUERY_DEFAULTS),
      sortBy: 'tvl' as const
    }
    const params = buildUrlParamsFromSnapshot(snapshot, DEFAULT_VAULT_QUERY_DEFAULTS)

    expect(params.get('sortBy')).toBe('tvl')
    expect(params.has('sortDirection')).toBe(false)
  })

  it('writes the direction for an active ascending sort', () => {
    const snapshot = {
      ...buildSnapshotFromParams(new URLSearchParams(), DEFAULT_VAULT_QUERY_DEFAULTS),
      sortBy: 'estAPY' as const,
      sortDirection: 'asc' as const
    }
    const params = buildUrlParamsFromSnapshot(snapshot, DEFAULT_VAULT_QUERY_DEFAULTS)

    expect(params.get('sortBy')).toBe('estAPY')
    expect(params.get('sortDirection')).toBe('asc')
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

  it('normalizes inactive sort directions to the descending sentinel', () => {
    const fromLegacyNone = buildSnapshotFromParams(
      new URLSearchParams('sortBy=none&sortDirection=asc'),
      DEFAULT_VAULT_QUERY_DEFAULTS
    )
    const fromDirectionOnly = buildSnapshotFromParams(
      new URLSearchParams('sortDirection=asc'),
      DEFAULT_VAULT_QUERY_DEFAULTS
    )

    expect(fromLegacyNone).toMatchObject({ sortBy: 'none', sortDirection: 'desc' })
    expect(fromDirectionOnly).toMatchObject({ sortBy: 'none', sortDirection: 'desc' })
  })

  it('removes inactive sort keys while preserving other query params', () => {
    const params = sanitizeInactiveSortParams(
      new URLSearchParams('search=usdc&sortBy=none&sortDirection=asc&utm_source=test')
    )

    expect(params.toString()).toBe('search=usdc&utm_source=test')
  })

  it('leaves an explicit public sort unchanged', () => {
    const params = sanitizeInactiveSortParams(new URLSearchParams('sortBy=deposited&sortDirection=asc'))

    expect(params.toString()).toBe('sortBy=deposited&sortDirection=asc')
  })
})
