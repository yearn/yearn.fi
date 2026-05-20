import { describe, expect, it } from 'vitest'
import { sanitizeTokenLogoURI } from './tokenLogo'

describe('sanitizeTokenLogoURI', () => {
  it('allows approved HTTPS token logo hosts', () => {
    expect(sanitizeTokenLogoURI('https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png')).toBe(
      'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
    )
    expect(sanitizeTokenLogoURI('https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/logo.png')).toBe(
      'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/logo.png'
    )
  })

  it.each([
    'https://example.com/logo.png',
    'http://tokens.1inch.io/logo.png',
    'data:image/svg+xml,<svg></svg>',
    'javascript:alert(1)',
    'blob:https://tokens.1inch.io/logo',
    '/tokens/1/logo.png',
    'not a url',
    '',
    undefined
  ])('rejects unsafe or unapproved logo URI %s', (logoURI) => {
    expect(sanitizeTokenLogoURI(logoURI)).toBeUndefined()
  })
})
