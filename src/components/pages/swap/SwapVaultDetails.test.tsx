import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SwapVaultAnnualReturnRow, SwapVaultWorthRow } from './SwapVaultDetails'
import type { TSwapVaultEstimate } from './swapVaultEstimate'

const estimate: TSwapVaultEstimate = {
  expectedUnderlying: 12.5,
  minimumUnderlying: 12,
  expectedUnderlyingUsd: 25,
  minimumUnderlyingUsd: 24,
  estimatedAnnualReturn: 1.2,
  estimatedAnnualReturnUsd: 2.4
}

describe('SwapVaultDetails', () => {
  it('shows only the minimum underlying value in the worth row', () => {
    const html = renderToStaticMarkup(
      <SwapVaultWorthRow estimate={estimate} underlyingSymbol="USDC" isLoading={false} />
    )

    expect(html).toContain('Worth at least:')
    expect(html).toContain('12.0 USDC')
    expect(html).toContain('$24.00')
    expect(html).not.toContain('12.5')
  })

  it('shows the annual return and APR independently', () => {
    const html = renderToStaticMarkup(
      <SwapVaultAnnualReturnRow estimate={estimate} underlyingSymbol="USDC" annualRate={0.1} isLoading={false} />
    )

    expect(html).toContain('Est. Annual Return')
    expect(html).toContain('1.20 USDC')
    expect(html).toContain('10.00% APR')
  })
})
