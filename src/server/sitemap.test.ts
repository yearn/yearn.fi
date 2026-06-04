import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, HEAD } from './sitemap'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

describe('sitemap route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns sitemap XML generated from the Kong vault list', async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      Response.json([
        {
          chainId: 1,
          address: address(1),
          isHidden: false,
          isRetired: false
        }
      ])
    )
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/xml')
    await expect(response.text()).resolves.toContain(`<loc>https://yearn.fi/vaults/1/${address(1)}</loc>`)
  })

  it('supports HEAD without returning a response body', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json([]))
    vi.stubGlobal('fetch', fetchStub)

    const response = await HEAD()

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('')
  })
})
