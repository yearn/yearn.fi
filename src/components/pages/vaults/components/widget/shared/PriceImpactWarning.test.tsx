import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PriceImpactWarning } from './PriceImpactWarning'

describe('PriceImpactWarning', () => {
  it('renders a compact summary with an info trigger when above tolerance', () => {
    const html = renderToStaticMarkup(
      <PriceImpactWarning
        percentage={2.5}
        userTolerancePercentage={1}
        isBlocking={false}
        isLoading={false}
        isDebouncing={false}
        isAmountSynced
        hasAmount
      />
    )

    expect(html).toContain('Total price impact is')
    expect(html).toContain('2.50%')
    expect(html).toContain('Price impact details')
    expect(html).not.toContain(
      'Increase your price impact tolerance in advanced settings by clicking the gear icon below if you want to continue.'
    )
  })

  it('omits the warning when the quote is within tolerance', () => {
    const html = renderToStaticMarkup(
      <PriceImpactWarning
        percentage={0.5}
        userTolerancePercentage={1}
        isBlocking={false}
        isLoading={false}
        isDebouncing={false}
        isAmountSynced
        hasAmount
      />
    )

    expect(html).toBe('')
  })
})
