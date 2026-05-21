import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTokenLogoSources, sanitizeTokenLogoURI } from './tokenLogo.utils'

const TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001'
const FALLBACK_SRC =
  'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/0x0000000000000000000000000000000000000001/logo-32.png'

describe('sanitizeTokenLogoURI', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows local absolute asset paths', () => {
    expect(sanitizeTokenLogoURI('/tokens/1/0x0000000000000000000000000000000000000001/logo.png')).toBe(
      '/tokens/1/0x0000000000000000000000000000000000000001/logo.png'
    )
  })

  it('allows http and https URLs from approved token asset hosts', () => {
    expect(sanitizeTokenLogoURI('https://token-assets.yearn.fi/tokens/1/logo.png')).toBe(
      'https://token-assets.yearn.fi/tokens/1/logo.png'
    )
    expect(sanitizeTokenLogoURI('http://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/logo.png')).toBe(
      'http://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/logo.png'
    )
  })

  it('allows the configured Yearn asset host', () => {
    vi.stubEnv('VITE_BASE_YEARN_ASSETS_URI', 'https://assets.example.yearn.test/tokenassets')

    expect(sanitizeTokenLogoURI('https://assets.example.yearn.test/tokens/1/logo.png')).toBe(
      'https://assets.example.yearn.test/tokens/1/logo.png'
    )
  })

  it('rejects unsafe schemes, protocol-relative URLs, malformed URLs, and unapproved hosts', () => {
    expect(sanitizeTokenLogoURI('data:image/svg+xml,<svg></svg>')).toBeUndefined()
    expect(sanitizeTokenLogoURI('blob:https://token-assets.yearn.fi/logo')).toBeUndefined()
    expect(sanitizeTokenLogoURI('javascript:alert(1)')).toBeUndefined()
    expect(sanitizeTokenLogoURI('file:///tmp/logo.png')).toBeUndefined()
    expect(sanitizeTokenLogoURI('//token-assets.yearn.fi/tokens/1/logo.png')).toBeUndefined()
    expect(sanitizeTokenLogoURI('https://example.com/logo.png')).toBeUndefined()
    expect(sanitizeTokenLogoURI('not a url')).toBeUndefined()
  })
})

describe('getTokenLogoSources', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to deterministic local token image props when a remote logoURI is rejected', () => {
    vi.stubEnv('VITE_BASE_YEARN_ASSETS_URI', 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main')

    expect(
      getTokenLogoSources({
        address: TOKEN_ADDRESS,
        chainId: 1,
        logoURI: 'https://example.com/logo.png',
        size: 32
      })
    ).toEqual({ src: FALLBACK_SRC })
  })

  it('keeps an approved logoURI as primary source and deterministic token image as alt source', () => {
    vi.stubEnv('VITE_BASE_YEARN_ASSETS_URI', 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main')

    expect(
      getTokenLogoSources({
        address: TOKEN_ADDRESS,
        chainId: 1,
        logoURI: 'https://token-assets.yearn.fi/tokens/1/logo.png',
        size: 32
      })
    ).toEqual({
      src: 'https://token-assets.yearn.fi/tokens/1/logo.png',
      altSrc: FALLBACK_SRC
    })
  })
})
