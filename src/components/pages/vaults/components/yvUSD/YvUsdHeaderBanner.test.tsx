import { YVUSD_LEARN_MORE_URL } from '@pages/vaults/utils/yvUsd'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { YvUsdHeaderBanner } from './YvUsdHeaderBanner'

describe('YvUsdHeaderBanner', () => {
  it('renders the mockup copy, links, and shipped banner assets', () => {
    const html = renderToStaticMarkup(<YvUsdHeaderBanner />)

    expect(html).toContain('Transparent, Verifiable, Real Yield')
    expect(html).toContain(`href="${YVUSD_LEARN_MORE_URL}"`)
    expect(html).toContain('yvusd-banner-bg.png')
    expect(html).toContain('Learn more')
    expect(html).toContain("about Yearn&#x27;s new cross-chain, cross-asset, delta-neutral vault.")
  })
})
