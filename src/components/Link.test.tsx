import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryNavigationProvider } from '@/navigation/client'
import Link from './Link'

describe('Link', () => {
  it('renders external links as <a> with safe defaults', () => {
    const html = renderToStaticMarkup(<Link href="https://example.com">Example</Link>)

    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders internal links through the navigation adapter', () => {
    const html = renderToStaticMarkup(
      <MemoryNavigationProvider>
        <Link href="/vaults">Vaults</Link>
      </MemoryNavigationProvider>
    )

    expect(html).toContain('href="/vaults"')
    expect(html).not.toContain('target="_blank"')
  })

  it('normalizes first-party absolute URLs for stable SSR', () => {
    const html = renderToStaticMarkup(
      <MemoryNavigationProvider>
        <Link href="https://yearn.fi/v3">Yearn V3</Link>
      </MemoryNavigationProvider>
    )

    expect(html).toContain('href="/v3"')
    expect(html).not.toContain('target="_blank"')
  })
})
