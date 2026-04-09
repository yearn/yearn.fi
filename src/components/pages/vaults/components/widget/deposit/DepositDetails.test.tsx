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
        expectedOutInAsset={9n * ONE_ETHER}
        assetTokenSymbol="yvUSDC"
        assetTokenDecimals={18}
        expectedVaultShares={9n * ONE_ETHER}
        vaultDecimals={18}
        sharesDisplayDecimals={18}
        pricePerShare={ONE_ETHER}
        assetUsdPrice={1}
        vaultShareValueInAsset={9n * ONE_ETHER}
        vaultShareValueUsdRaw={9}
        priceImpactPercentage={10}
        shouldHighlightPriceImpact
        willReceiveStakedShares={false}
        onShowVaultSharesModal={() => undefined}
        onShowVaultShareValueModal={() => undefined}
        estimatedAnnualReturn={1}
        onShowAnnualReturnModal={() => undefined}
      />
    )

    expect(html).toContain('Worst case price impact')
    expect(html).toContain('10.00%')
    expect(html).toContain('text-red-500')
  })
})
