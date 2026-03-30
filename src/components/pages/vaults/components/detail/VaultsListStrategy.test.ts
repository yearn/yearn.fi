import { describe, expect, it } from 'vitest'

import { STRATEGY_PANEL_ROW_DESKTOP_LAYOUT } from './strategiesLayout'

describe('VaultsListStrategy desktop layout', () => {
  it('uses tightened strategy row desktop column classes with balanced desktop title wrapping', () => {
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.nameColumnSpanClass).toBe('md:col-span-11')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.valuesColumnSpanClass).toBe('md:col-span-12')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.valuesGridClass).toBe('md:grid-cols-12 md:gap-2')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.valueColumnSpanClass).toBe('md:col-span-4')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.nameLabelDesktopWrapClass).toBe(
      'md:[display:-webkit-box] md:[-webkit-box-orient:vertical] md:[-webkit-line-clamp:2] md:[text-wrap:balance] md:whitespace-normal'
    )
  })
})
