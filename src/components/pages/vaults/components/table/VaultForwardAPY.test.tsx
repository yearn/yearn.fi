// @vitest-environment jsdom

import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { VaultForwardAPY } from './VaultForwardAPY'

vi.mock('@vaults/hooks/useVaultApyData', () => ({
  useVaultApyData: vi.fn()
}))

const vault = {
  chainID: 1,
  address: '0x0000000000000000000000000000000000000001',
  apr: { forwardAPR: { type: '' }, type: '' },
  staking: { source: 'None' }
} as unknown as TKongVaultInput

describe('VaultForwardAPY', () => {
  it('shows subline tooltip when hovering the value', () => {
    vi.useFakeTimers()
    vi.mocked(useVaultApyData).mockReturnValue({
      mode: 'spot',
      baseForwardApr: 0.1,
      netApr: 0,
      rewardsAprSum: 0,
      isBoosted: false,
      hasPendleArbRewards: true,
      hasKelp: false,
      hasKelpNEngenlayer: false,
      isEligibleForSteer: false,
      steerPointsPerDollar: 0,
      katanaExtras: undefined,
      katanaThirtyDayApr: undefined,
      katanaEstApr: undefined
    })

    const { container, queryByText } = render(
      <VaultForwardAPY currentVault={vault} showSubline={false} showSublineTooltip />
    )
    const trigger = container.querySelector('.apy-subline-tooltip')

    expect(trigger).not.toBeNull()
    expect(queryByText('+ 2500 ARB/week')).toBeNull()

    fireEvent.mouseEnter(trigger as Element)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(queryByText('+ 2500 ARB/week')).not.toBeNull()
    vi.useRealTimers()
  })
})
