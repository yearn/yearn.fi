import { afterEach, describe, expect, it, vi } from 'vitest'

const UNDERLYING_VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const STAKING_VAULT = '0x622fa41799406b120f9a40da843d358b7b2cfee3'

function createVaultListResponse(): Response {
  return new Response(
    JSON.stringify([
      {
        address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
        apiVersion: '3.0.2',
        chainId: 1,
        symbol: 'yvUSDC',
        decimals: 6,
        v3: true,
        asset: {
          address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          symbol: 'USDC',
          decimals: 6
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

function createVaultSnapshotResponse(): Response {
  return new Response(
    JSON.stringify({
      address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
      apiVersion: '3.0.2',
      chainId: 1,
      symbol: 'yvUSDC',
      decimals: 6,
      v3: true,
      asset: {
        address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        decimals: 6
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
      token: {
        address: UNDERLYING_VAULT,
        symbol: 'yvUSDC',
        decimals: 6
      },
      decimals: 6
    })
  })
})
