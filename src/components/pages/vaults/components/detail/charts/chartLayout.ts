export const CHART_RIGHT_GUTTER = 0
export const CHART_WITH_AXES_MARGIN = {
  top: 20,
  right: CHART_RIGHT_GUTTER,
  left: 0,
  bottom: 20
}

export const CHART_Y_AXIS_TICK_MARGIN = 0
export const CHART_Y_AXIS_WIDTH = 12
export const CHART_Y_AXIS_TICK_STYLE = {
  fill: 'var(--chart-axis)',
  textAnchor: 'start' as const,
  dx: 6
}

export const CHART_TOOLTIP_WRAPPER_STYLE: React.CSSProperties = {
  zIndex: 50,
  pointerEvents: 'none',
  maxWidth: 'calc(100vw - 32px)'
}
