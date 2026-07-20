import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from './markdown'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

describe('vault markdown route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('validates the vault address before calling Kong', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(new Request('https://yearn.fi/api/vault/markdown?chainId=1&address=not-an-address'))

    expect(response.status).toBe(400)
    expect(fetchStub).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid address' })
  })

  it('returns markdown generated from a Kong vault snapshot', async () => {
    const vaultAddress = address(1)
    const fetchStub = vi.fn().mockResolvedValue(
      Response.json(
        {
          address: vaultAddress,
          chainId: 1,
          name: 'USDC Vault',
          symbol: 'yvUSDC',
          blockTime: 1_788_265_211,
          asset: { name: 'USD Coin', symbol: 'USDC', address: address(2), chainId: 1, decimals: 6 },
          tvl: { close: 1_000_000 },
          apy: { net: 0.03, grossApr: 0.04 },
          fees: { performanceFee: 1000, managementFee: 0 }
        },
        {
          headers: {
            'Last-Modified': 'Mon, 31 Aug 2026 09:00:00 GMT',
            'x-last-refresh': '2026-09-01T13:00:00.000Z'
          }
        }
      )
    )
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(
      new Request(`https://yearn.fi/api/vault/markdown?chainId=1&address=${encodeURIComponent(vaultAddress)}`)
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    const markdown = await response.text()
    expect(markdown).toContain('# USDC Vault')
    expect(markdown).toContain('generated_at:')
    expect(markdown).toContain('source_updated_at: 2026-09-01T12:20:11.000Z')
    expect(markdown).toContain('cache_refreshed_at: 2026-09-01T13:00:00.000Z')
    expect(markdown).not.toMatch(/^updated:/m)
  })

  it('rejects malformed Kong snapshots', async () => {
    const vaultAddress = address(1)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ name: 'Incomplete Vault' })))

    const response = await GET(
      new Request(`https://yearn.fi/api/vault/markdown?chainId=1&address=${encodeURIComponent(vaultAddress)}`)
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid vault data from upstream' })
  })
})
