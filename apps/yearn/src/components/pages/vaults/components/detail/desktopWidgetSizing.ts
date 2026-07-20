export const DESKTOP_WIDGET_BOTTOM_PADDING_PX = 16
const DESKTOP_WIDGET_VIEWPORT_PADDING_PX = 16
export const DESKTOP_WIDGET_OFFSET_CSS_VAR = '--vault-header-compressed-offset'

export function resolveDesktopWidgetHeaderOffset({
  baseOffset,
  headerHeight,
  bottomPadding = DESKTOP_WIDGET_BOTTOM_PADDING_PX
}: {
  baseOffset: number
  headerHeight: number
  bottomPadding?: number
}): number | null {
  if (!Number.isFinite(baseOffset) || !Number.isFinite(headerHeight) || headerHeight <= 0) {
    return null
  }

  return Math.round(baseOffset + headerHeight + bottomPadding)
}

export function getDesktopWidgetHeightClassNames(offsetCssVar: string = DESKTOP_WIDGET_OFFSET_CSS_VAR): {
  container: string
  stack: string
} {
  return {
    container: `md:h-[calc(100vh-var(${offsetCssVar})-${DESKTOP_WIDGET_VIEWPORT_PADDING_PX}px)] max-h-[calc(100vh-var(${offsetCssVar})-${DESKTOP_WIDGET_VIEWPORT_PADDING_PX}px)]`,
    stack: `max-h-[calc(100vh-${DESKTOP_WIDGET_VIEWPORT_PADDING_PX}px-var(${offsetCssVar}))]`
  }
}
