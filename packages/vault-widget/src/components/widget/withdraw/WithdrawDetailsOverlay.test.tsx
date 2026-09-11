import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WithdrawDetailsOverlay } from './WithdrawDetailsOverlay'

const PARTIAL_YSYBOLD_SHARES = 914_516_886_161_070_330n
const MAX_YSYBOLD_SHARES = 9_208_468_548_860_078_928n

function renderWithdrawDetails(sourceShareAmount: bigint): string {
  return renderToStaticMarkup(
    <WithdrawDetailsOverlay
      isOpen
      onClose={() => undefined}
      sourceTokenSymbol="ysyBOLD"
      sourceTokenDecimals={18}
      sourceShareAmount={sourceShareAmount}
      vaultAssetSymbol="BOLD"
      outputTokenSymbol="USDC"
      expectedOutput="1"
      hasInputValue
      stakingAddress="0x23346B04a7f55b8760E5860AA5A77383D63491cD"
      withdrawalSource="staking"
      routeType="ENSO"
      isZap
      hasSwap
      usesMinExpectedOut
      isLoadingQuote={false}
    />
  )
}

describe('WithdrawDetailsOverlay', () => {
  it('shows converted source shares for a partial staking withdrawal', () => {
    const html = renderWithdrawDetails(PARTIAL_YSYBOLD_SHARES)

    expect(html).toContain('0.915 ysyBOLD')
    expect(html).not.toContain('1.00 ysyBOLD')
  })

  it('shows exact redeemable source shares for a max staking withdrawal', () => {
    const html = renderWithdrawDetails(MAX_YSYBOLD_SHARES)

    expect(html).toContain('9.21 ysyBOLD')
    expect(html).not.toContain('10.1 ysyBOLD')
  })
})
