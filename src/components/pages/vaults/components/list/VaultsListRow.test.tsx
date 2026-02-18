// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { zeroAddress } from 'viem'

import { VaultsListRow } from './VaultsListRow'

vi.mock('@vaults/components/table/VaultForwardAPY', () => ({
  VaultForwardAPY: () => <div>{'APY'}</div>,
  VaultForwardAPYInlineDetails: () => <div>{'APY details'}</div>
}))

vi.mock('@vaults/components/table/VaultHistoricalAPY', () => ({
  VaultHistoricalAPY: () => <div>{'Historical APY'}</div>
}))

vi.mock('@vaults/components/table/VaultHoldingsAmount', () => ({
  VaultHoldingsAmount: () => <div>{'Holdings'}</div>
}))

vi.mock('@vaults/components/table/VaultRiskScoreTag', () => ({
  VaultRiskScoreTag: () => <div>{'Risk'}</div>,
  RiskScoreInlineDetails: () => <div>{'Risk details'}</div>
}))

describe('VaultsListRow', () => {
  it('shows TVL native units tooltip when hovering the value', () => {
    vi.useFakeTimers()
    type TRowVault = ComponentProps<typeof VaultsListRow>['currentVault']
    const vault: TRowVault = {
      version: '3.0.0',
      type: 'Yearn Vault',
      chainID: 1,
      address: '0x0000000000000000000000000000000000000001',
      symbol: 'yvTKN',
      name: 'Test Vault',
      description: '',
      category: 'Test Category',
      kind: 'Multi Strategy',
      decimals: 18,
      token: {
        address: '0x0000000000000000000000000000000000000002',
        name: 'Test Token',
        symbol: 'TKN',
        description: '',
        decimals: 6
      },
      tvl: {
        tvl: 1234,
        totalAssets: 1234567n,
        price: 1
      },
      apr: {
        type: 'unknown',
        netAPR: 0,
        fees: {
          performance: 0,
          withdrawal: 0,
          management: 0
        },
        extra: {
          stakingRewardsAPR: 0,
          gammaRewardAPR: 0
        },
        points: {
          weekAgo: 0,
          monthAgo: 0,
          inception: 0
        },
        pricePerShare: {
          today: 1,
          weekAgo: 1,
          monthAgo: 1
        },
        forwardAPR: {
          type: 'unknown',
          netAPR: 0,
          composite: {
            boost: 0,
            poolAPY: 0,
            boostedAPR: 0,
            baseAPR: 0,
            cvxAPR: 0,
            rewardsAPR: 0,
            v3OracleCurrentAPR: 0,
            v3OracleStratRatioAPR: 0,
            keepCRV: 0,
            keepVELO: 0,
            cvxKeepCRV: 0
          }
        }
      },
      featuringScore: 0,
      strategies: [],
      staking: {
        address: zeroAddress,
        available: false,
        source: '',
        rewards: []
      },
      migration: {
        available: false,
        address: zeroAddress,
        contract: zeroAddress
      },
      info: {
        sourceURL: '',
        riskLevel: 3,
        riskScore: [],
        riskScoreComment: '',
        uiNotice: '',
        isRetired: false,
        isBoosted: false,
        isHighlighted: false,
        isHidden: false
      }
    }

    const { container, queryByText } = render(
      <MemoryRouter>
        <VaultsListRow currentVault={vault} />
      </MemoryRouter>
    )

    const trigger = container.querySelector('.tvl-subline-tooltip')

    expect(trigger).not.toBeNull()
    expect(queryByText('TKN')).toBeNull()

    fireEvent.mouseEnter(trigger as Element)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(queryByText('TKN')).not.toBeNull()
    vi.useRealTimers()
  })
})
