import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VaultRiskSection } from './VaultRiskSection'

describe('VaultRiskSection', () => {
  it('uses normal snapshot-backed risk information for yvUSD', () => {
    const html = renderToStaticMarkup(
      <VaultRiskSection
        currentVault={
          {
            address: YVUSD_UNLOCKED_ADDRESS,
            chainID: 1,
            version: '3.0.4',
            kind: 'Multi Strategy',
            info: {
              riskLevel: 4,
              riskScore: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1],
              riskScoreComment: 'Snapshot risk comment'
            }
          } as never
        }
      />
    )

    expect(html).toContain('Overall Risk Score')
    expect(html).toContain('This risk score determines what strategies can be added to this vault')
    expect(html).not.toContain('Leverage Looping')
  })

  it('temporarily uses static risk information for yvBTC', () => {
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
