import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VaultRiskSection } from './VaultRiskSection'

describe('VaultRiskSection', () => {
  it('temporarily reuses yvUSD risk information for yvBTC', () => {
    const html = renderToStaticMarkup(
      <VaultRiskSection
        currentVault={
          {
            address: YVBTC_UNLOCKED_ADDRESS,
            symbol: 'yvBTC',
            kind: 'Multi Strategy',
            info: {
              riskLevel: 0,
              riskScore: [],
              riskScoreComment: ''
            }
          } as never
        }
      />
    )

    expect(html).toContain('Leverage Looping')
    expect(html).toContain('Duration and PT Strategies')
    expect(html).toContain('Cross-Chain Routing')
  })
})
