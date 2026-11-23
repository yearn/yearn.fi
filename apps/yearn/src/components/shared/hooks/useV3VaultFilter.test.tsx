// @vitest-environment jsdom

import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useV3VaultFilter } from '@shared/hooks/useV3VaultFilter'
import { toNormalizedBN } from '@shared/utils/format'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@pages/vaults/contexts/useAppSettings', () => ({
  useAppSettings: () => ({ shouldHideDust: false })
}))
vi.mock('@shared/contexts/useWallet', () => ({
  useWalletStatus: () => ({ isLoading: false }),
  useWalletTokens: () => ({ getBalance: () => toNormalizedBN(0n, 18) })
}))
vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: () => ({ getPrice: () => toNormalizedBN(0n, 18), vaults: {}, allVaults: {}, isLoadingVaultList: false })
}))

afterEach(cleanup)

const swanVault = {
  chainId: 1,
  address: '0xcE918671E6D9e56E19c5Cbc4DC45655d80C65265',
  name: 'SWAN yVault',
  symbol: 'yvSWAN',
  apiVersion: '3.1.1',
  decimals: 18,
  asset: { address: '0xD0a32F6d4850F9D6DF7d4F8f84af1Fcd3Cf993CC', name: 'SwanDAO', symbol: 'SWAN', decimals: 18 },
  tvl: 9985,
  kind: 'Multi Strategy',
  type: 'Yearn Vault',
  category: '',
  v3: true,
  isRetired: false,
  isHidden: false,
  isHighlighted: false,
  migration: false,
  origin: 'yearn'
} as unknown as TKongVaultInput

const vaultSource = { vaults: { swan: swanVault }, allVaults: { swan: swanVault }, isLoadingVaultList: false }

const renderFilter = (search: string) =>
  renderHook(() => useV3VaultFilter(null, null, search, null, null, null, 0, false, null, true, vaultSource)).result
    .current.filteredVaults

it('keeps non-featured allocator vaults out of the default list', () => {
  expect(renderFilter('')).toEqual([])
})

it('returns non-featured allocator vaults when they match the search', () => {
  expect(renderFilter('swan')).toEqual([swanVault])
})
