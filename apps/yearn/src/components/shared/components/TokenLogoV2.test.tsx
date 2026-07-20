import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TokenLogoV2 } from './TokenLogoV2'

describe('TokenLogoV2', () => {
  it('renders the image source in SSR output without a loading initials fallback', () => {
    const html = renderToStaticMarkup(
      <TokenLogoV2 src="https://example.com/yvusdc.png" tokenSymbol="yvUSDC-1" width={24} height={24} />
    )

    expect(html).toContain('https://example.com/yvusdc.png')
    expect(html).not.toContain('>YV<')
  })

  it('renders initials when no image source is available', () => {
    const html = renderToStaticMarkup(<TokenLogoV2 tokenSymbol="yvUSDC-1" width={24} height={24} />)

    expect(html).toContain('>YV<')
    expect(html).not.toContain('<img')
  })
})
