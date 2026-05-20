import { describe, expect, it } from 'vitest'
import { getTokenLogoSources } from './tokenLogo.utils'

const TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001'

describe('getTokenLogoSources', () => {
  it('uses an approved HTTPS logo URI as the primary source', () => {
    const logoURI = 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'

    expect(getTokenLogoSources({ address: TOKEN_ADDRESS, chainId: 1, logoURI })).toEqual({
      src: logoURI,
      altSrc: `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/1/${TOKEN_ADDRESS}/logo-32.png`
    })
  })

  it.each([
    'https://example.com/logo.png',
    'data:image/svg+xml,<svg></svg>',
    'javascript:alert(1)',
    'blob:test'
  ])('falls back to the canonical Yearn asset for unsafe logo URI %s', (logoURI) => {
    expect(getTokenLogoSources({ address: TOKEN_ADDRESS, chainId: 1, logoURI })).toEqual({
      src: `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/1/${TOKEN_ADDRESS}/logo-32.png`
    })
  })
})
