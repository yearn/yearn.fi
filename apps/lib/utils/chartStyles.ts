export const CHART_STYLES = {
  minimal: {
    label: 'Minimal',
    vars: {
      '--chart-1': '#2578ff',
      '--chart-2': '#46a2ff',
      '--chart-3': '#94adf2',
      '--chart-4': '#b0b5bf',
      '--chart-axis': 'var(--color-neutral-500)',
      '--chart-grid': 'var(--color-neutral-200)',
      '--chart-cursor-line': 'var(--color-neutral-200)',
      '--chart-cursor-fill': 'var(--color-neutral-100)',
      '--chart-radial-bg': 'var(--color-neutral-100)',
      '--chart-tooltip-bg': 'var(--color-surface)',
      '--chart-tooltip-border': 'hsl(0 0% 0% / 0.08)',
      '--chart-tooltip-radius': '12px',
      '--chart-tooltip-shadow': '0 25px 50px -12px hsl(0 0% 0% / 0.25)'
    }
  },
  powerglove: {
    label: 'PowerGlove',
    vars: {
      '--chart-1': '#46a2ff',
      '--chart-2': '#46a2ff',
      '--chart-3': '#94adf2',
      '--chart-4': '#b0b5bf',
      '--chart-axis': 'var(--color-text-tertiary)',
      '--chart-grid': 'var(--color-border)',
      '--chart-cursor-line': 'var(--color-border)',
      '--chart-cursor-fill': 'var(--color-surface-secondary)',
      '--chart-radial-bg': 'var(--color-surface-secondary)',
      '--chart-tooltip-bg': 'var(--color-app)',
      '--chart-tooltip-border': 'var(--color-border)',
      '--chart-tooltip-radius': '8px',
      '--chart-tooltip-shadow': '0 25px 50px -12px hsl(0 0% 0% / 0.35)'
    }
  }
} as const

export type TChartStyle = keyof typeof CHART_STYLES

export const CHART_STYLE_OPTIONS: Array<{ id: TChartStyle; label: string }> = (
  Object.keys(CHART_STYLES) as TChartStyle[]
).map((id) => ({ id, label: CHART_STYLES[id].label }))

export function getChartStyleVariables(style: TChartStyle): Record<string, string> {
  return CHART_STYLES[style].vars
}
