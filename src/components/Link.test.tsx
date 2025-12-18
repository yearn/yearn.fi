import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Link from './Link'

describe('Link', () => {
  it('renders external links as <a> with safe defaults', () => {
    const originalWindow = globalThis.window
    ;(globalThis as unknown as { window: unknown }).window = {
      location: { href: 'https://yearn.fi/', hostname: 'yearn.fi' }
    }

    try {
      const html = renderToStaticMarkup(<Link href="https://example.com">Example</Link>)

      expect(html).toContain('href="https://example.com"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    } finally {
      ;(globalThis as unknown as { window: unknown }).window = originalWindow
    }
  })

  it('renders internal links through react-router', () => {
    const originalWindow = globalThis.window
    ;(globalThis as unknown as { window: unknown }).window = {
      location: { href: 'https://yearn.fi/', hostname: 'yearn.fi' }
    }

    try {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Link href="/apps">Apps</Link>
        </MemoryRouter>
      )

      expect(html).toContain('href="/apps"')
      expect(html).not.toContain('target="_blank"')
    } finally {
      ;(globalThis as unknown as { window: unknown }).window = originalWindow
    }
  })
})
