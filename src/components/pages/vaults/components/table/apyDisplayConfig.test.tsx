import { KATANA_CHAIN_ID, SPECTRA_MARKET_VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { TVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { resolveHistoricalApyDisplayConfig } from './apyDisplayConfig'

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
    fixedRateKatanaRewards: 4,
    katanaAppRewardsAPR: 3,
    katanaBonusAPY: 2,
    steerPointsPerDollar: 0
  },
  katanaThirtyDayApr: 12,
  katanaEstApr: 12
} as TVaultApyData

describe('resolveHistoricalApyDisplayConfig', () => {
  it('includes Spectra boost details in Katana 30 Day APY modal content', () => {
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
