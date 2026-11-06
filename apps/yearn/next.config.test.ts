import { getRewrittenUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import { describe, expect, it } from 'vitest'
import nextConfig from './next.config'

describe('Yearn Plausible proxy', () => {
  it('keeps analytics event requests on the app origin', async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: 'https://yearn.fi/proxy/plausible/api/event?probe=1',
      nextConfig
    })

    expect(getRewrittenUrl(response)).toBe(null)
  })

  it.each([
    '/proxy/plausible/js/script.js',
    '/proxy/plausible/js/pa-example.js',
    '/proxy/plausible/api/event/script.js'
  ])('does not proxy vendor content at %s', async (pathname) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://yearn.fi${pathname}`,
      nextConfig
    })

    expect(getRewrittenUrl(response)).toBe(null)
  })
})
