import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, HEAD, OPTIONS } from './markdown'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

function vault(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chainId: 1,
    address: address(1),
    name: 'Test Vault',
    symbol: 'yvTEST',
    apiVersion: '3.0.0',
    decimals: 18,
    asset: { address: address(2), name: 'Test Token', symbol: 'TEST', decimals: 18 },
    tvl: 1_000,
    performance: null,
    fees: null,
    category: null,
    type: 'Yearn Vault',
    kind: 'Multi Strategy',
    v3: true,
    isRetired: false,
    isHidden: false,
    isBoosted: false,
    isHighlighted: false,
    inclusion: { isYearn: true },
    origin: 'yearn',
    strategiesCount: 0,
    riskLevel: null,
    staking: null,
    ...overrides
  }
}

describe('vaults markdown route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns markdown generated from the Kong vault list', async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      Response.json([vault({ updatedAt: '2026-08-31T10:00:00.000Z' })], {
        headers: { 'Last-Modified': 'Mon, 31 Aug 2026 09:00:00 GMT' }
      })
    )
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(new Request('https://yearn.fi/api/vaults/markdown?chainId=1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    const markdown = await response.text()
    expect(markdown).toContain('[Test Vault](https://yearn.fi/vaults/1/')
    expect(markdown).toContain('generated_at:')
    expect(markdown).toContain('source_updated_at: 2026-08-31T10:00:00.000Z')
    expect(markdown).not.toMatch(/^updated:/m)
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

  it.each([
    'https://yearn.fi/api/vaults/markdown?chainId=ethereum',
    'https://yearn.fi/api/vaults/markdown?chainId=0',
    'https://yearn.fi/api/vaults/markdown?chainId=1&chainId=10'
  ])('rejects an invalid or ambiguous chain filter before fetching Kong', async (url) => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(new Request(url))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid chainId' })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('rejects malformed Kong payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ vaults: [] })))

    const response = await GET(new Request('https://yearn.fi/api/vaults/markdown'))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid vault list from upstream' })
  })
})
