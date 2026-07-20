import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MetricHeader } from './MetricsCard'

describe('MetricHeader', () => {
  it('renders a React mobileLabel when tooltip content is present', () => {
    const html = renderToStaticMarkup(
      <MetricHeader
        label={<span>{'Desktop Label'}</span>}
        mobileLabel={
          <span>
            <span>{'Your Deposits'}</span>
            <span>{'Cooling Down'}</span>
          </span>
        }
        tooltip={'Tooltip copy'}
      />
    )

    expect(html).toContain('Desktop Label')
    expect(html).toContain('Your Deposits')
    expect(html).toContain('Cooling Down')
  })
})
