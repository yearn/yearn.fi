import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Link from './Link'

vi.mock('react-router', () => {
  return {
    Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
      <a data-router-link href={to} {...rest}>
        {children}
      </a>
    )
  }
})

describe('Link component', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://yearn.fi/',
        hostname: 'yearn.fi'
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses RouterLink for internal navigation', () => {
    const markup = renderToStaticMarkup(<Link href="/vaults">Vaults</Link>)
    expect(markup).toContain('data-router-link')
    expect(markup).toContain('href="/vaults"')
  })

  it('falls back to anchor for external URLs with defaults', () => {
    const markup = renderToStaticMarkup(<Link href="https://twitter.com/yearnfi">Twitter</Link>)
    expect(markup).not.toContain('data-router-link')
    expect(markup).toContain('href="https://twitter.com/yearnfi"')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
  })

  it('allows overriding target/rel and prioritises href over to', () => {
    const markup = renderToStaticMarkup(
      <Link href="https://docs.yearn.fi" to="/apps" target="_self" rel="noopener">
        Docs
      </Link>
    )
    expect(markup).not.toContain('data-router-link')
    expect(markup).toContain('href="https://docs.yearn.fi"')
    expect(markup).toContain('target="_self"')
    expect(markup).toContain('rel="noopener"')
  })
})
