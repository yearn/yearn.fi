import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'

import { getProductPinnedSections } from './useVaultsListModel.helpers'

const YVBTC_VAULT = {
  version: '3.0.4',
  chainID: 1,
  address: YVBTC_UNLOCKED_ADDRESS,
  name: 'BTC yVault',
  symbol: 'yvBTC',
  category: 'Volatile'
} as unknown as TKongVaultInput

const YVUSD_VAULT = {
  version: '3.0.4',
  chainID: 1,
  address: YVUSD_UNLOCKED_ADDRESS,
  name: 'yvUSD',
  symbol: 'yvUSD',
  category: 'Stablecoin'
} as unknown as TKongVaultInput

const STANDARD_VAULT = {
  version: '3.0.4',
  chainID: 1,
  address: '0x0000000000000000000000000000000000000003',
  name: 'Test Vault',
  symbol: 'yvTEST',
  category: 'Stablecoin'
} as unknown as TKongVaultInput

describe('getProductPinnedSections', () => {
  it('pins yvBTC first and keeps yvUSD pinned after it', () => {
    expect(
      getProductPinnedSections({
        sortedVaults: [STANDARD_VAULT, YVBTC_VAULT],
        shouldShowYvUsd: true,
        yvUsdVault: YVUSD_VAULT
      })
    ).toEqual([
      { key: 'yvBTC', vaults: [YVBTC_VAULT] },
      { key: 'yvUSD', vaults: [YVUSD_VAULT] }
    ])
  })
})
