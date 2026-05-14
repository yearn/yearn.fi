import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'

import { getProductPinnedSections } from './useVaultsListModel.helpers'

const YVUSD_VAULT = {
  version: '3.0.4',
  chainID: 1,
  address: YVUSD_UNLOCKED_ADDRESS,
  name: 'yvUSD',
  symbol: 'yvUSD',
  category: 'Stablecoin'
} as unknown as TKongVaultInput

describe('getProductPinnedSections', () => {
  it('pins yvUSD when it matches the active filters', () => {
    expect(
      getProductPinnedSections({
        shouldShowYvUsd: true,
        yvUsdVault: YVUSD_VAULT
      })
    ).toEqual([{ key: 'yvUSD', vaults: [YVUSD_VAULT] }])
  })
})
