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
        usesMinExpectedOut
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
        usesMinExpectedOut
        onShowDetailsModal={() => undefined}
      />
    )

    expect(html).toContain('Est. / Worst price impact')
    expect(html).toContain('0.00%')
    expect(html).toContain('-10.00%')
    expect(html).toContain('text-red-500')
  })

  it('uses protected receive copy for routed ENSO withdrawals without swaps', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel="You will redeem"
        requiredShares={10n * ONE_ETHER}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={10n * ONE_ETHER}
        outputDecimals={18}
        outputSymbol="USDC"
        showSwapRow={false}
        withdrawAmountSimple="10"
        withdrawAmountBn={10n * ONE_ETHER}
        assetDecimals={18}
        assetUsdPrice={1}
        assetSymbol="yvUSD"
        outputUsdPrice={1}
        expectedPriceImpactPercentage={0}
        priceImpactPercentage={0}
        shouldHighlightPriceImpact={false}
        usesMinExpectedOut
        onShowDetailsModal={() => undefined}
      />
    )

    expect(html).toContain('You will receive')
    expect(html).toContain('You will receive at least')
    expect(html).not.toContain('You will swap')
    expect(html).toContain('Est. / Worst price impact')
  })

  it('shows positive slippage for favorable zap withdrawals', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel="You will redeem"
        requiredShares={10n * ONE_ETHER}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={10n * ONE_ETHER}
        outputDecimals={18}
        outputSymbol="USDC"
        showSwapRow
        withdrawAmountSimple="10"
        withdrawAmountBn={10n * ONE_ETHER}
        assetDecimals={18}
        assetUsdPrice={1}
        assetSymbol="BOLD"
        outputUsdPrice={1}
        expectedPriceImpactPercentage={-6}
        priceImpactPercentage={-3}
        shouldHighlightPriceImpact={false}
        usesMinExpectedOut
        onShowDetailsModal={() => undefined}
      />
    )

    expect(html).toContain('+6.00%')
    expect(html).toContain('+3.00%')
  })

  it('masks existing approval details while an ENSO quote is loading', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel="You will redeem"
        requiredShares={10n * ONE_ETHER}
        sharesDecimals={18}
        isLoadingQuote
        isApprovalLoading
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
        usesMinExpectedOut
        onShowDetailsModal={() => undefined}
        allowance={123n * ONE_ETHER}
        allowanceTokenDecimals={18}
        allowanceTokenSymbol="yvUSD"
        approvalSpenderName="Enso Router"
        onShowApprovalOverlay={() => undefined}
      />
    )

    expect(html).not.toContain('Existing Approval')
    expect(html).not.toContain('Enso Router')
    expect(html).not.toContain('123')
    expect(html).toContain('animate-pulse')
  })
})
