import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WithdrawDetails } from './WithdrawDetails'

const ONE_ETHER = 10n ** 18n

describe('WithdrawDetails', () => {
  it('omits ENSO USD badges when token prices are unavailable', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel="You will redeem"
        requiredShares={10n * ONE_ETHER}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={5n * ONE_ETHER}
        outputDecimals={18}
        outputSymbol="USDC"
        showSwapRow
        withdrawAmountSimple="10"
        withdrawAmountBn={10n * ONE_ETHER}
        assetDecimals={18}
        assetUsdPrice={0}
        assetSymbol="yvUSD"
        outputUsdPrice={0}
        expectedPriceImpactPercentage={0}
        priceImpactPercentage={0}
        shouldHighlightPriceImpact={false}
        routeType="ENSO"
        onShowDetailsModal={() => undefined}
      />
    )

    expect(html).not.toContain('($0.00)')
  })

  it('shows the worst-case price impact row for zap withdrawals', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel="You will redeem"
        requiredShares={10n * ONE_ETHER}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={9n * ONE_ETHER}
        outputDecimals={18}
        outputSymbol="USDC"
        showSwapRow
        withdrawAmountSimple="10"
        withdrawAmountBn={10n * ONE_ETHER}
        assetDecimals={18}
        assetUsdPrice={1}
        assetSymbol="yvUSD"
        outputUsdPrice={1}
        expectedPriceImpactPercentage={0}
        priceImpactPercentage={10}
        shouldHighlightPriceImpact
        routeType="ENSO"
        onShowDetailsModal={() => undefined}
      />
    )

    expect(html).toContain('Est. / Worst price impact')
    expect(html).toContain('0.00%')
    expect(html).toContain('10.00%')
    expect(html).toContain('text-red-500')
  })
})
