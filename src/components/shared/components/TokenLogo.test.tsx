import { TokenLogo } from '@shared/components/TokenLogo'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

describe('TokenLogo', () => {
  it('does not render unsafe primary or fallback image sources', () => {
    const html = renderToStaticMarkup(
      <TokenLogo src={`java\nscript:alert(1)`} altSrc={'data:image/svg+xml,<svg></svg>'} tokenSymbol={'BAD'} />
    )

    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript')
    expect(html).not.toContain('data:image')
  })

  it('uses a safe fallback image source when the primary source is unsafe', () => {
    const localFallbackSrc = '/tokens/1/0x0000000000000000000000000000000000000001/logo.png'
    const html = renderToStaticMarkup(
      <TokenLogo src={'blob:https://token-assets.yearn.fi/logo'} altSrc={localFallbackSrc} tokenSymbol={'SAFE'} />
    )

    expect(html).toContain(localFallbackSrc)
    expect(html).not.toContain('blob:')
  })
})
