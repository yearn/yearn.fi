import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from './markdown'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

describe('vault markdown route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
      Response.json({
        name: 'USDC Vault',
        symbol: 'yvUSDC',
        asset: { name: 'USD Coin', symbol: 'USDC', address: address(2) },
        tvl: { close: 1_000_000 },
        apy: { net: 0.03, grossApr: 0.04 },
        fees: { performanceFee: 1000, managementFee: 0 }
      })
    )
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(
      new Request(`https://yearn.fi/api/vault/markdown?chainId=1&address=${encodeURIComponent(vaultAddress)}`)
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    await expect(response.text()).resolves.toContain('# USDC Vault')
  })
})
