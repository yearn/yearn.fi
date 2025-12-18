import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FixedHeightChartContainer } from './FixedHeightChartContainer'

describe('FixedHeightChartContainer', () => {
  it('uses CSS variables for Tailwind height classes', () => {
    const html = renderToStaticMarkup(
      <FixedHeightChartContainer heightPx={150} heightMdPx={200}>
        <div>{'child'}</div>
      </FixedHeightChartContainer>
    )

    expect(html).toContain('h-[var(--chart-height)]')
    expect(html).toContain('md:h-[var(--chart-height-md)]')
    expect(html).toContain('--chart-height:150px')
    expect(html).toContain('--chart-height-md:200px')
    expect(html).toContain('.fixed-height-chart-container .aspect-video')
  })
})
