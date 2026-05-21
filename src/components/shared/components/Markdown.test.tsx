import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('suppresses markdown image nodes', () => {
    const html = renderToStaticMarkup(<Markdown content={'Intro ![tracking pixel](https://example.com/x.png) outro'} />)

    expect(html).not.toContain('<img')
    expect(html).not.toContain('https://example.com/x.png')
    expect(html).toContain('Intro')
    expect(html).toContain('outro')
  })

  it('renders markdown text and links with safe external-link attributes', () => {
    const html = renderToStaticMarkup(<Markdown content={'**Vault** [docs](https://docs.yearn.fi)'} />)

    expect(html).toContain('<strong')
    expect(html).toContain('Vault')
    expect(html).toContain('href="https://docs.yearn.fi"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('docs')
  })
})
