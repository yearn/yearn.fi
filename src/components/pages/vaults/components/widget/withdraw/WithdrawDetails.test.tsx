import { WithdrawDetails } from '@pages/vaults/components/widget/withdraw/WithdrawDetails'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

describe('WithdrawDetails', () => {
  it('shows usd values for zap swap and receive rows', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel={'You will redeem'}
        requiredShares={15_700000000000000000000n}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={16_100000000n}
        outputDecimals={6}
        outputSymbol={'yvUSDC-2'}
        showSwapRow={true}
        withdrawAmountSimple={'17.9K'}
        withdrawAmountBn={17_900000000000000000000n}
        assetDecimals={18}
        assetUsdPrice={1}
        assetSymbol={'crvUSD'}
        outputUsdPrice={1.11}
        routeType={'ENSO'}
        onShowDetailsModal={vi.fn()}
      />
    )

    expect(html).toContain('($17,900)')
    expect(html).toContain('($17,871)')
  })

  it('keeps direct withdraw receive row unchanged without extra usd text', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel={'You will redeem'}
        requiredShares={15_700000000000000000000n}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={16_100000000n}
        outputDecimals={6}
        outputSymbol={'USDC'}
        showSwapRow={false}
        withdrawAmountSimple={'17.9K'}
        withdrawAmountBn={17_900000000000000000000n}
        assetDecimals={18}
        assetUsdPrice={1}
        assetSymbol={'USDC'}
        outputUsdPrice={1}
        routeType={'DIRECT_WITHDRAW'}
        onShowDetailsModal={vi.fn()}
      />
    )

    expect(html).not.toContain('($17,900)')
    expect(html).not.toContain('($16,100)')
  })
})
