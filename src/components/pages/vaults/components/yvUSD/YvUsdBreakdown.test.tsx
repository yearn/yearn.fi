import { YVUSD_LOCKED_COOLDOWN_DAYS } from '@pages/vaults/utils/yvUsd'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { YvUsdApyTooltipContent } from './YvUsdBreakdown'

describe('YvUsdApyTooltipContent', () => {
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

  it('does not show a more-information modal action', () => {
    const html = renderToStaticMarkup(<YvUsdApyTooltipContent lockedValue={0.09} unlockedValue={0.05} />)

    expect(html).not.toContain('data-tooltip-close="true"')
    expect(html).not.toContain('Click for more information')
  })
})
