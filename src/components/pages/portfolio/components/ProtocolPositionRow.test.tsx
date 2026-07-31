import { ProtocolPositionRow } from '@pages/portfolio/components/ProtocolPositionRow'
import type { TPortfolioProtocolPosition } from '@pages/portfolio/types/position'
import { toAddress } from '@shared/utils'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const position: TPortfolioProtocolPosition = {
  id: 'ycrv-boosted-staker',
  name: 'Staked yCRV',
  symbol: 'yCRV',
  href: 'https://ycrv.yearn.fi/app/stake',
  tokenAddress: toAddress('0xFCc5c47bE19d06BF83eB04298b026F81069ff65b'),
  decimals: 18,
  activeRaw: 100n * 10n ** 18n,
  cooldownRaw: 0n,
  withdrawableRaw: 0n,
  walletRaw: 0n,
  valueUsd: 25,
  tvlUsd: 10_000_000,
  apy: 0.08,
  boostMultiplier: 2
}

describe('ProtocolPositionRow', () => {
  it('renders yCRV position metrics using the existing portfolio row vocabulary', () => {
    const html = renderToStaticMarkup(<ProtocolPositionRow position={position} />)

    expect(html).toContain('Staked yCRV')
    expect(html).toContain('yCRV')
    expect(html).toContain('8.00%')
    expect(html).toContain('$25.0')
    expect(html).toContain('$10.0M')
    expect(html).toContain('2.0x boost')
    expect(html).toContain('https://ycrv.yearn.fi/app/stake')
    expect(html.match(/yearn--table-data-section-item-value font-semibold text-text-primary/g)).toHaveLength(3)
  })
})
