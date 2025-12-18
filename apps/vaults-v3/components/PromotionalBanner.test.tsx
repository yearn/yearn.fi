import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { PromotionalBanner } from './PromotionalBanner'

describe('PromotionalBanner', () => {
  it('renders a clickable close button above content layers', () => {
    vi.stubGlobal('window', { location: { href: 'https://app.yearn.fi/', hostname: 'app.yearn.fi' } })

    const markup = renderToStaticMarkup(
      <PromotionalBanner
        title={'Title'}
        subtitle={'Subtitle'}
        description={'Description'}
        ctaLabel={'CTA'}
        ctaTo={'https://example.com'}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('aria-label="Close banner"')
    expect(markup.match(/aria-label="Close banner"/g)?.length).toBe(2)
    expect(markup.match(/\bz-20\b/g)?.length).toBe(2)
    expect(markup.match(/type="button"/g)?.length).toBe(2)
  })
})
