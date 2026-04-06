import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { YvUsdApyDetailsContent } from './YvUsdBreakdown'

describe('YvUsdApyDetailsContent', () => {
  it('describes the locked withdrawal window as 5 days', () => {
    const html = renderToStaticMarkup(<YvUsdApyDetailsContent lockedValue={0.09} unlockedValue={0.05} />)

    expect(html).toContain('Withdrawals are open for 5 days once the cooldown ends.')
  })
})
