import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Link from './Link'

describe('Link', () => {
  it('renders external links as <a> with safe defaults', () => {
    const html = renderToStaticMarkup(<Link href="https://example.com">Example</Link>)

    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders internal links through react-router', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Link href="/vaults">Vaults</Link>
      </MemoryRouter>
    )

    expect(html).toContain('href="/vaults"')
    expect(html).not.toContain('target="_blank"')
  })

  it('normalizes first-party absolute URLs for stable SSR', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Link href="https://yearn.fi/v3">Yearn V3</Link>
      </MemoryRouter>
    )

    expect(html).toContain('href="/v3"')
    expect(html).not.toContain('target="_blank"')
  })
})
