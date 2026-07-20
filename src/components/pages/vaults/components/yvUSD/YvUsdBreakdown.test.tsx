import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { YvUsdApyDetailsContent, YvUsdPositionApyTooltipContent } from './YvUsdBreakdown'

describe('YvUsdApyDetailsContent', () => {
  it('describes the locked withdrawal window as 5 days', () => {
    const html = renderToStaticMarkup(<YvUsdApyDetailsContent lockedValue={0.09} unlockedValue={0.05} />)

    expect(html).toContain('Withdrawals are open for 5 days once the cooldown ends.')
  })
})

describe('YvUsdPositionApyTooltipContent', () => {
  it('shows each position weight, value, and APY', () => {
    const html = renderToStaticMarkup(
      <YvUsdPositionApyTooltipContent
        breakdown={{
          blendedApy: 0.07,
          locked: { apy: 0.09, value: 100, weight: 0.5 },
          unlocked: { apy: 0.05, value: 100, weight: 0.5 }
        }}
      />
    )

    expect(html).toContain('Your yvUSD APY breakdown')
    expect(html).toContain('Locked')
    expect(html).toContain('Unlocked')
    expect(html).toContain('50.0% of position')
    expect(html).toContain('$100.00')
    expect(html).toContain('9.00%')
    expect(html).toContain('5.00%')
  })
})
