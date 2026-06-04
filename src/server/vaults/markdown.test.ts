import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, HEAD, OPTIONS } from './markdown'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

describe('vaults markdown route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns markdown generated from the Kong vault list', async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      Response.json([
        {
          chainId: 1,
          address: address(1),
          name: 'Test Vault',
          symbol: 'yvTEST',
          apiVersion: '3.0.0',
          asset: { name: 'Test Token', symbol: 'TEST' },
          tvl: 1000,
          performance: null,
          isHidden: false,
          isRetired: false,
          v3: true,
          type: 'Yearn Vault',
          kind: 'Multi Strategy',
          origin: 'yearn',
          inclusion: { isYearn: true }
        }
      ])
    )
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(new Request('https://yearn.fi/api/vaults/markdown?chainId=1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    await expect(response.text()).resolves.toContain('[Test Vault](https://yearn.fi/vaults/1/')
  })

  it('supports HEAD without returning a response body', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json([]))
    vi.stubGlobal('fetch', fetchStub)

    const response = await HEAD(new Request('https://yearn.fi/api/vaults/markdown'))

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('')
  })

  it('supports CORS preflight', () => {
    const response = OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
  })
})
