import { KATANA_CHAIN_ID, SPECTRA_MARKET_VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { TVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveForwardApyDisplayConfig, resolveHistoricalApyDisplayConfig } from './apyDisplayConfig'

const KATANA_SPECTRA_VAULT = {
  version: '3.0.0',
  chainID: KATANA_CHAIN_ID,
  address: SPECTRA_MARKET_VAULT_ADDRESSES[0],
  token: {
    address: '0x0000000000000000000000000000000000000001'
  },
  apr: {
    type: '',
    points: {
      monthAgo: 0.1,
      weekAgo: 0.1
    }
  }
} as unknown as TKongVaultInput

const KATANA_APY_DATA = {
  mode: 'katana',
  baseForwardApr: 0,
  netApr: 0,
  rewardsAprSum: 0,
  isBoosted: false,
  hasPendleArbRewards: false,
  hasKelp: false,
  hasKelpNEngenlayer: false,
  katanaExtras: {
    katanaAppRewardsAPR: 3,
    steerPointsPerDollar: 0
  },
  katanaThirtyDayApr: 7.1,
  katanaEstApr: 7
} as TVaultApyData

const PENDLE_ARB_VAULT = {
  chainID: 1,
  address: '0x0000000000000000000000000000000000000001',
  info: {
    isBoosted: false
  },
  apr: {
    forwardAPR: { type: '' },
    type: ''
  },
  staking: {
    source: 'None'
  }
} as unknown as TKongVaultInput

const PENDLE_ARB_APY_DATA = {
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
} as TVaultApyData

describe('resolveForwardApyDisplayConfig', () => {
  it('includes Pendle ARB rewards in the subline tooltip content', () => {
    const { displayConfig } = resolveForwardApyDisplayConfig({
      currentVault: PENDLE_ARB_VAULT,
      data: PENDLE_ARB_APY_DATA,
      displayVariant: 'default',
      showSubline: false,
      showSublineTooltip: true,
      showBoostDetails: true,
      canOpenModal: true
    })

    const tooltip = displayConfig.tooltip
    expect(tooltip).toBeDefined()
    expect(tooltip?.mode).toBe('tooltip')
    expect(isValidElement(tooltip?.content)).toBe(true)
    expect(renderToStaticMarkup(tooltip?.content)).toContain('+ 2500 ARB/week')
  })
})

describe('resolveHistoricalApyDisplayConfig', () => {
  it('includes Spectra boost details in Katana Historical APY modal content', () => {
    const { modalConfig } = resolveHistoricalApyDisplayConfig({
      currentVault: KATANA_SPECTRA_VAULT,
      data: KATANA_APY_DATA,
      showSublineTooltip: true
    })

    expect(modalConfig?.canOpen).toBe(true)
    expect(isValidElement(modalConfig?.content)).toBe(true)
    if (isValidElement<{ isEligibleForSpectraBoost?: boolean }>(modalConfig?.content)) {
      expect(modalConfig.content.props.isEligibleForSpectraBoost).toBe(true)
    }
  })
})
