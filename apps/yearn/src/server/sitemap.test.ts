import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, HEAD } from './sitemap'

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

describe('sitemap route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns sitemap XML generated from the Kong vault list', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json([vault({ updatedAt: '2026-08-31T10:00:00.000Z' })]))
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/xml')
    const xml = await response.text()
    expect(xml).toContain(`<loc>https://yearn.fi/vaults/1/${address(1)}</loc>`)
    expect(xml).toContain('<lastmod>2026-08-31T10:00:00.000Z</lastmod>')
    expect(fetchStub).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('supports HEAD without returning a response body', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json([vault()]))
    vi.stubGlobal('fetch', fetchStub)

    const response = await HEAD()

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('')
  })

  it('returns a non-cacheable 502 instead of a static-only sitemap when Kong fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))

    const response = await GET()

    expect(response.status).toBe(502)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('')
  })

  it.each([
    ['a non-array payload', { vaults: [vault()] }],
    ['an empty vault list', []],
    ['a malformed vault entry', [{ chainId: 1, address: 'unsafe' }]]
  ])('returns 502 for %s', async (_description, payload) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))

    const response = await GET()

    expect(response.status).toBe(502)
    await expect(response.text()).resolves.toBe('')
  })
})
