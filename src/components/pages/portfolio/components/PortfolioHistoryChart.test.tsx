import { PortfolioHistoryCompletenessNotice } from '@pages/portfolio/components/PortfolioHistoryChart'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

describe('PortfolioHistoryCompletenessNotice', () => {
  it('shows an estimated balance notice only for an incomplete balance chart', () => {
    const incompleteHtml = renderToStaticMarkup(
      <PortfolioHistoryCompletenessNotice
        activeTab={'balance'}
        balanceIsComplete={false}
        protocolReturnIsComplete={true}
      />
    )
    const completeHtml = renderToStaticMarkup(
      <PortfolioHistoryCompletenessNotice
        activeTab={'balance'}
        balanceIsComplete={true}
        protocolReturnIsComplete={false}
      />
    )

    expect(incompleteHtml).toContain('Estimated balance')
    expect(incompleteHtml).toContain('Some historical vault pricing is missing')
    expect(completeHtml).toBe('')
  })

  it.each([
    'growth',
    'annualized',
    'index'
  ] as const)('shows an estimated return notice for an incomplete %s chart', (activeTab) => {
    const html = renderToStaticMarkup(
      <PortfolioHistoryCompletenessNotice
        activeTab={activeTab}
        balanceIsComplete={true}
        protocolReturnIsComplete={false}
      />
    )

    expect(html).toContain('Estimated return')
    expect(html).toContain('Some historical return inputs are missing or unmatched')
  })
})
