import { YVUSD_LOCKED_COOLDOWN_DAYS } from '@pages/vaults/utils/yvUsd'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { YvUsdApyDetailsContent, YvUsdApyTooltipContent } from './YvUsdBreakdown'

describe('YvUsdApyDetailsContent', () => {
  it('describes the locked withdrawal window as 5 days', () => {
    const html = renderToStaticMarkup(<YvUsdApyDetailsContent lockedValue={0.09} unlockedValue={0.05} />)

    expect(html).toContain('Withdrawals are open for 5 days once the cooldown ends.')
  })

  it('uses a tighter icon gap for the unlocked APY label', () => {
    const html = renderToStaticMarkup(<YvUsdApyTooltipContent lockedValue={0.09} unlockedValue={0.05} />)

    expect(html).toContain('inline-flex items-center text-text-secondary gap-1')
  })

  it('explains locked and unlocked APY in the tooltip', () => {
    const html = renderToStaticMarkup(<YvUsdApyTooltipContent lockedValue={0.09} unlockedValue={0.05} />)

    expect(html).toContain('Locked:')
    expect(html).toContain(`Shares require a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown before withdrawal.`)
    expect(html).toContain('Unlocked:')
    expect(html).toContain('Shares can be withdrawn without a cooldown.')
  })

  it('shows the more-information action when one is available', () => {
    const html = renderToStaticMarkup(
      <YvUsdApyTooltipContent lockedValue={0.09} unlockedValue={0.05} onRequestMoreInfo={() => undefined} />
    )

    expect(html).toContain('data-tooltip-close="true"')
    expect(html).toContain('Click for more information')
  })
})
