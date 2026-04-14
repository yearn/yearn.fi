import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DepositDetails } from './DepositDetails'

const ONE_ETHER = 10n ** 18n

describe('DepositDetails', () => {
  it('shows the worst-case price impact row for zap deposits', () => {
    const html = renderToStaticMarkup(
      <DepositDetails
        depositAmountBn={10n * ONE_ETHER}
        inputTokenSymbol="USDC"
        inputTokenDecimals={18}
        inputTokenUsdPrice={1}
        routeType="ENSO"
        isSwap
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOutInAsset={10n * ONE_ETHER}
        minExpectedOutInAsset={9n * ONE_ETHER}
        assetTokenSymbol="yvUSDC"
        assetTokenDecimals={18}
        expectedVaultShares={9n * ONE_ETHER}
        vaultDecimals={18}
        sharesDisplayDecimals={18}
        pricePerShare={ONE_ETHER}
        assetUsdPrice={1}
        vaultShareValueInAsset={9n * ONE_ETHER}
        vaultShareValueUsdRaw={9}
        expectedPriceImpactPercentage={0}
        priceImpactPercentage={10}
        shouldHighlightPriceImpact
        willReceiveStakedShares={false}
        onShowVaultSharesModal={() => undefined}
        onShowVaultShareValueModal={() => undefined}
        estimatedAnnualReturn={1}
        onShowAnnualReturnModal={() => undefined}
      />
    )

    expect(html).toContain('For expected / at least')
    expect(html).toContain('10.0')
    expect(html).toContain('| </span><span class="font-semibold">9.00')
    expect(html).toContain('Est. / Worst price impact')
    expect(html).toContain('0.00%')
    expect(html).toContain('-10.00%')
    expect(html).toContain('text-red-500')
  })

  it('uses deposit-style copy for routed ENSO deposits without swaps', () => {
    const html = renderToStaticMarkup(
      <DepositDetails
        depositAmountBn={10n * ONE_ETHER}
        inputTokenSymbol="USDC"
        inputTokenDecimals={18}
        inputTokenUsdPrice={1}
        routeType="ENSO"
        isSwap={false}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOutInAsset={10n * ONE_ETHER}
        minExpectedOutInAsset={10n * ONE_ETHER}
        assetTokenSymbol="yvUSDC"
        assetTokenDecimals={18}
        expectedVaultShares={10n * ONE_ETHER}
        vaultDecimals={18}
        sharesDisplayDecimals={18}
        pricePerShare={ONE_ETHER}
        assetUsdPrice={1}
        vaultShareValueInAsset={10n * ONE_ETHER}
        vaultShareValueUsdRaw={10}
        expectedPriceImpactPercentage={0}
        priceImpactPercentage={0}
        shouldHighlightPriceImpact={false}
        willReceiveStakedShares={false}
        onShowVaultSharesModal={() => undefined}
        onShowVaultShareValueModal={() => undefined}
        estimatedAnnualReturn={1}
        onShowAnnualReturnModal={() => undefined}
      />
    )

    expect(html).toContain('You Will Deposit')
    expect(html).not.toContain('For expected / at least')
    expect(html).not.toContain('Est. / Worst price impact')
  })

  it('shows positive slippage for favorable swap quotes', () => {
    const html = renderToStaticMarkup(
      <DepositDetails
        depositAmountBn={10n * ONE_ETHER}
        inputTokenSymbol="BOLD"
        inputTokenDecimals={18}
        inputTokenUsdPrice={1}
        routeType="ENSO"
        isSwap
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOutInAsset={10n * ONE_ETHER}
        minExpectedOutInAsset={10n * ONE_ETHER}
        assetTokenSymbol="yvUSDC"
        assetTokenDecimals={18}
        expectedVaultShares={10n * ONE_ETHER}
        vaultDecimals={18}
        sharesDisplayDecimals={18}
        pricePerShare={ONE_ETHER}
        assetUsdPrice={1}
        vaultShareValueInAsset={10n * ONE_ETHER}
        vaultShareValueUsdRaw={10}
        expectedPriceImpactPercentage={-5}
        priceImpactPercentage={-2}
        shouldHighlightPriceImpact={false}
        willReceiveStakedShares={false}
        onShowVaultSharesModal={() => undefined}
        onShowVaultShareValueModal={() => undefined}
        estimatedAnnualReturn={1}
        onShowAnnualReturnModal={() => undefined}
      />
    )

    expect(html).toContain('+5.00%')
    expect(html).toContain('+2.00%')
  })
})
