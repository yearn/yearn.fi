import { describe, expect, it } from 'vitest'
import {
  DESKTOP_WIDGET_OFFSET_CSS_VAR,
  getDesktopWidgetHeightClassNames,
  resolveDesktopWidgetHeaderOffset
} from './desktopWidgetSizing'

describe('resolveDesktopWidgetHeaderOffset', () => {
  it('rounds the combined base offset, measured header height, and widget padding', () => {
    expect(resolveDesktopWidgetHeaderOffset({ baseOffset: 72.2, headerHeight: 180.6 })).toBe(269)
  })

  it('returns null until a positive header height is available', () => {
    expect(resolveDesktopWidgetHeaderOffset({ baseOffset: 72, headerHeight: 0 })).toBeNull()
  })
})

describe('getDesktopWidgetHeightClassNames', () => {
  it('uses the compressed header offset by default for both container and stack sizing', () => {
    expect(getDesktopWidgetHeightClassNames()).toEqual({
      container: `md:h-[calc(100vh-var(${DESKTOP_WIDGET_OFFSET_CSS_VAR})-16px)] max-h-[calc(100vh-var(${DESKTOP_WIDGET_OFFSET_CSS_VAR})-16px)]`,
      stack: `max-h-[calc(100vh-16px-var(${DESKTOP_WIDGET_OFFSET_CSS_VAR}))]`
    })
  })

  it('supports an alternate offset variable when the layout needs a different measurement source', () => {
    expect(getDesktopWidgetHeightClassNames('--vault-header-expanded-offset')).toEqual({
      container:
        'md:h-[calc(100vh-var(--vault-header-expanded-offset)-16px)] max-h-[calc(100vh-var(--vault-header-expanded-offset)-16px)]',
      stack: 'max-h-[calc(100vh-16px-var(--vault-header-expanded-offset))]'
    })
  })
})
