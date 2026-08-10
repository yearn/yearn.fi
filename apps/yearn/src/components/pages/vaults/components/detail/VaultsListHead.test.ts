import { describe, expect, it } from 'vitest'

import { STRATEGY_PANEL_HEAD_DESKTOP_LAYOUT } from './strategiesLayout'

describe('VaultsListHead desktop layout', () => {
  it('uses tightened strategy panel desktop column classes', () => {
    expect(STRATEGY_PANEL_HEAD_DESKTOP_LAYOUT.nameColumnSpanClass).toBe('col-span-11')
    expect(STRATEGY_PANEL_HEAD_DESKTOP_LAYOUT.valuesColumnSpanClass).toBe('col-span-12')
    expect(STRATEGY_PANEL_HEAD_DESKTOP_LAYOUT.valuesGridClass).toBe('md:grid-cols-12 md:gap-2')
    expect(STRATEGY_PANEL_HEAD_DESKTOP_LAYOUT.valueColumnSpanClass).toBe('md:col-span-4')
  })
})
