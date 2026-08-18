import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferred } from '@/server/lib/holdings/test-utils/deferred'

const UNDERLYING_VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const STAKING_VAULT = '0x622fa41799406b120f9a40da843d358b7b2cfee3'

function createVaultListResponse(
  decimals: { readonly vault: number | string; readonly asset: number | string } = { vault: 6, asset: 6 }
): Response {
  return new Response(
    JSON.stringify([
      {
        address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
        apiVersion: '3.0.2',
        chainId: 1,
        symbol: 'yvUSDC',
        decimals: decimals.vault,
        pricePerShare: '1050000',
        v3: true,
        asset: {
          address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          symbol: 'USDC',
          decimals: decimals.asset
        },
        staking: {
          address: '0x622fa41799406b120f9a40da843d358b7b2cfee3',
          available: true
        }
      }
    ]),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )
}

function createVaultSnapshotResponse(
  decimals: { readonly vault: number | string; readonly asset: number | string } = { vault: 6, asset: 6 }
): Response {
  return new Response(
    JSON.stringify({
      address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
      apiVersion: '3.0.2',
      chainId: 1,
      symbol: 'yvUSDC',
      decimals: decimals.vault,
      v3: true,
      apy: {
        pricePerShare: '1040000'
      },
      asset: {
        address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        decimals: decimals.asset
      },
      staking: {
        address: '0x622fa41799406b120f9a40da843d358b7b2cfee3',
        available: true
      }
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )
}

async function importVaultsModule() {
  vi.resetModules()
  return import('./vaults')
}

describe('fetchMultipleVaultsMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('retries transient vault list failures and loads metadata', async () => {
    const fetchStub = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' }))
      .mockResolvedValue(createVaultListResponse())

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([
      { chainId: 1, vaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204' }
    ])

    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(metadata.get(`1:${UNDERLYING_VAULT}`)?.token.symbol).toBe('USDC')
    expect(metadata.get(`1:${UNDERLYING_VAULT}`)?.currentPricePerShare).toBeCloseTo(1.05)
  })

  it('coalesces a global metadata prefetch with targeted metadata resolution', async () => {
    const vaultListResponse = createDeferred<Response>()
    const fetchStub = vi.fn().mockReturnValue(vaultListResponse.promise)

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata, prefetchGlobalVaultMetadata } = await importVaultsModule()
    const prefetchPromise = prefetchGlobalVaultMetadata()
    const metadataPromise = fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    expect(fetchStub).toHaveBeenCalledTimes(1)
    vaultListResponse.resolve(createVaultListResponse())

    const [, metadata] = await Promise.all([prefetchPromise, metadataPromise])
    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(metadata.get(`1:${UNDERLYING_VAULT}`)?.token.symbol).toBe('USDC')
  })

  it('clears process metadata between isolated benchmark cold requests', async () => {
    const fetchStub = vi.fn().mockImplementation(() => Promise.resolve(createVaultListResponse()))
    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata, resetGlobalVaultMetadataCacheForBenchmark } = await importVaultsModule()
    await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])
    await resetGlobalVaultMetadataCacheForBenchmark()
    await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent snapshot fallbacks for the same vault', async () => {
    const snapshotResponse = createDeferred<Response>()
    const fetchStub = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/list/vaults?origin=yearn')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        )
      }
      if (url.includes(`/snapshot/1/${UNDERLYING_VAULT}`)) {
        return snapshotResponse.promise
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()
    const first = fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])
    const second = fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    await vi.waitFor(() => {
      expect(fetchStub).toHaveBeenCalledTimes(2)
    })
    snapshotResponse.resolve(createVaultSnapshotResponse())

    const [firstMetadata, secondMetadata] = await Promise.all([first, second])
    expect(firstMetadata.get(`1:${UNDERLYING_VAULT}`)?.token.symbol).toBe('USDC')
    expect(secondMetadata.get(`1:${UNDERLYING_VAULT}`)?.token.symbol).toBe('USDC')
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('normalizes numeric-string decimals at the Kong boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createVaultListResponse({ vault: '18', asset: '6' })))

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    expect(metadata.get(`1:${UNDERLYING_VAULT}`)).toMatchObject({
      decimals: 18,
      token: { decimals: 6 }
    })
    expect(metadata.get(`1:${UNDERLYING_VAULT}`)?.currentPricePerShare).toBeCloseTo(1.05)
  })

  it('normalizes numeric-string decimals from snapshot fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/list/vaults?origin=yearn')) {
        throw Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })
      }

      if (url.includes(`/snapshot/1/${UNDERLYING_VAULT}`)) {
        return createVaultSnapshotResponse({ vault: '18', asset: '6' })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    expect(metadata.get(`1:${UNDERLYING_VAULT}`)).toMatchObject({
      decimals: 18,
      token: { decimals: 6 }
    })
  })

  it('falls back to per-vault snapshots when the global list endpoint is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/list/vaults?origin=yearn')) {
        throw Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })
      }

      if (url.includes(`/snapshot/1/${UNDERLYING_VAULT}`)) {
        return createVaultSnapshotResponse()
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    expect(metadata.get(`1:${UNDERLYING_VAULT}`)?.token.address).toBe('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
    expect(metadata.get(`1:${UNDERLYING_VAULT}`)?.currentPricePerShare).toBeCloseTo(1.04)
    expect(fetchStub).toHaveBeenCalledTimes(4)
  })

  it('builds staking metadata from the underlying snapshot fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/list/vaults?origin=yearn')) {
        throw Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })
      }

      if (url.includes(`/snapshot/1/${UNDERLYING_VAULT}`)) {
        return createVaultSnapshotResponse()
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: STAKING_VAULT }])

    expect(metadata.get(`1:${STAKING_VAULT}`)).toEqual({
      address: STAKING_VAULT,
      chainId: 1,
      version: 'v3',
      category: 'stable',
      isHidden: false,
      token: {
        address: UNDERLYING_VAULT,
        symbol: 'yvUSDC',
        decimals: 6
      },
      decimals: 6
    })
  })

  it('retries the global vault list after snapshot fallback seeded the metadata cache', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let listAttempts = 0
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/list/vaults?origin=yearn')) {
        listAttempts += 1
        if (listAttempts === 1) {
          throw Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })
        }
        return createVaultListResponse()
      }

      if (url.includes(`/snapshot/1/${UNDERLYING_VAULT}`)) {
        return createVaultSnapshotResponse()
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata } = await importVaultsModule()

    const first = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])
    expect(first.get(`1:${UNDERLYING_VAULT}`)?.token.symbol).toBe('USDC')

    const second = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])
    expect(second.get(`1:${UNDERLYING_VAULT}`)?.token.symbol).toBe('USDC')
    expect(listAttempts).toBe(2)
  })

  it('reports fallback metadata requests that still fail after retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/list/vaults?origin=yearn')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      throw Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' })
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchMultipleVaultsMetadata, getVaultMetadataFetchFailedVaults } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }])

    expect(metadata.size).toBe(0)
    expect(getVaultMetadataFetchFailedVaults(metadata)).toBe(1)
  })

  it('reports a failed vault list when snapshot fallback is intentionally skipped', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })))

    const { fetchMultipleVaultsMetadata, getVaultMetadataFetchFailedVaults } = await importVaultsModule()
    const metadata = await fetchMultipleVaultsMetadata([{ chainId: 1, vaultAddress: UNDERLYING_VAULT }], {
      skipSnapshotFallback: true
    })

    expect(metadata.size).toBe(0)
    expect(getVaultMetadataFetchFailedVaults(metadata)).toBe(1)
  })
})
