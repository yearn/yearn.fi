// @vitest-environment jsdom

import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { VaultsV3ListRow } from './VaultsV3ListRow'

vi.mock('@vaults-v3/components/table/VaultForwardAPY', () => ({
  VaultForwardAPY: () => <div>{'APY'}</div>,
  VaultForwardAPYInlineDetails: () => <div>{'APY details'}</div>
}))

vi.mock('@vaults-v3/components/table/VaultHistoricalAPY', () => ({
  VaultHistoricalAPY: () => <div>{'Historical APY'}</div>
}))

vi.mock('@vaults-v3/components/table/VaultHoldingsAmount', () => ({
  VaultHoldingsAmount: () => <div>{'Holdings'}</div>
}))

vi.mock('@vaults-v3/components/table/VaultRiskScoreTag', () => ({
  VaultRiskScoreTag: () => <div>{'Risk'}</div>,
  RiskScoreInlineDetails: () => <div>{'Risk details'}</div>
}))

describe('VaultsV3ListRow', () => {
  it('shows TVL native units tooltip when hovering the value', () => {
    vi.useFakeTimers()
    const vault = {
      chainID: 1,
      address: '0x0000000000000000000000000000000000000001',
      name: 'Test Vault',
      category: 'Test Category',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'TKN',
        decimals: 6
      },
      tvl: {
        tvl: 1234,
        totalAssets: 1234567
      },
      info: {
        riskLevel: 3
      }
    } as unknown as TYDaemonVault

    const { container, queryByText } = render(
      <MemoryRouter>
        <VaultsV3ListRow currentVault={vault} />
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
