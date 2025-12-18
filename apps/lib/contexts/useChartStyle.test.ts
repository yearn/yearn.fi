import { CHART_STYLE_OPTIONS, getChartStyleVariables } from '@lib/utils/chartStyles'
import { describe, expect, it } from 'vitest'

describe('chart styles', () => {
  it('exposes minimal and powerglove options', () => {
    expect(CHART_STYLE_OPTIONS.map((o) => o.id)).toEqual(expect.arrayContaining(['minimal', 'blended', 'powerglove']))
  })

  it('provides a palette for each style', () => {
    const minimal = getChartStyleVariables('minimal')
    const powerglove = getChartStyleVariables('powerglove')

    expect(minimal['--chart-1']).toBeTruthy()
    expect(minimal['--chart-2']).toBeTruthy()
    expect(minimal['--chart-3']).toBeTruthy()
    expect(minimal['--chart-4']).toBeTruthy()
    expect(powerglove['--chart-1']).toBeTruthy()
    expect(powerglove['--chart-2']).toBeTruthy()
    expect(powerglove['--chart-3']).toBeTruthy()
    expect(powerglove['--chart-4']).toBeTruthy()
  })
})
