import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS } from '@/components/pages/vaults/utils/yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/components/pages/vaults/utils/yvUsd'
import {
  buildVaultSnapshotEndpoint,
  YEARN_TVL_ENDPOINT,
  YEARN_VAULT_LIST_ENDPOINT
} from '@/components/shared/data/publicQueryEndpoints'
import {
  getLandingPageDehydratedState,
  getVaultDetailPageDehydratedState,
  getVaultsPageDehydratedState
} from './publicDataHydration'

const DETAIL_ADDRESS = '0x0000000000000000000000000000000000000001'

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function buildSnapshotFromUrl(url: string): { address: string; chainId: number } {
  const [, rawPath] = url.split('/snapshot/')
  const [chainId, address] = rawPath.split('/')

  return {
    address,
    chainId: Number(chainId)
  }
}

function queryKeys(state: Awaited<ReturnType<typeof getVaultsPageDehydratedState>>): unknown[] {
  return state.queries.map((query) => query.queryKey)
}

describe('public data SSR hydration', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const requestUrl = url.toString()
        if (requestUrl === YEARN_TVL_ENDPOINT) {
          return jsonResponse(123456)
        }
        if (requestUrl === YEARN_VAULT_LIST_ENDPOINT) {
          return jsonResponse([])
        }
        if (requestUrl.includes('/snapshot/')) {
          return jsonResponse(buildSnapshotFromUrl(requestUrl))
        }
        return jsonResponse({})
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hydrates the landing TVL query', async () => {
    const state = await getLandingPageDehydratedState()

    expect(queryKeys(state)).toContainEqual(['fetch', YEARN_TVL_ENDPOINT])
    expect(state.queries[0]?.state.data).toBe(123456)
  })

  it('hydrates vault list public queries used by the vaults page', async () => {
    const state = await getVaultsPageDehydratedState()

    expect(queryKeys(state)).toEqual(
      expect.arrayContaining([
        ['fetch', YEARN_VAULT_LIST_ENDPOINT],
        ['fetch', buildVaultSnapshotEndpoint(YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS)],
        ['fetch', buildVaultSnapshotEndpoint(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)],
        ['fetch', buildVaultSnapshotEndpoint(YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS)]
      ])
    )
  })

  it('hydrates only the requested ordinary vault detail snapshot without user-specific data', async () => {
    const state = await getVaultDetailPageDehydratedState(1, DETAIL_ADDRESS)
    const keys = queryKeys(state)

    expect(keys).toContainEqual(['fetch', buildVaultSnapshotEndpoint(1, DETAIL_ADDRESS)])
    expect(keys).not.toContainEqual(['fetch', YEARN_VAULT_LIST_ENDPOINT])
    expect(keys).not.toContainEqual(['fetch', buildVaultSnapshotEndpoint(YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS)])
    expect(keys).not.toContainEqual(['fetch', buildVaultSnapshotEndpoint(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)])
    expect(keys).not.toContainEqual(['fetch', buildVaultSnapshotEndpoint(YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS)])
  })

  it('hydrates related yvUSD variant data for yvUSD vault details', async () => {
    const state = await getVaultDetailPageDehydratedState(YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS)
    const keys = queryKeys(state)

    expect(keys).toEqual(
      expect.arrayContaining([
        ['fetch', buildVaultSnapshotEndpoint(YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS)],
        ['fetch', buildVaultSnapshotEndpoint(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)]
      ])
    )
    expect(keys).not.toContainEqual(['fetch', YEARN_VAULT_LIST_ENDPOINT])
    expect(keys).not.toContainEqual(['fetch', buildVaultSnapshotEndpoint(YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS)])
  })
})
