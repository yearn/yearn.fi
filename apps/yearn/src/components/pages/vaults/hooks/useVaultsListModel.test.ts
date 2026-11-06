// @vitest-environment jsdom

import { YVUSD_TRANCHE_DEPLOYMENT } from '@pages/vaults/constants/tranchedProducts'
import { useVaultsListModel } from '@pages/vaults/hooks/useVaultsListModel'
import { buildSyntheticBaseVault, buildYvUsdVaultsModel } from '@pages/vaults/hooks/useYvUsdVaults.helpers'
import { YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: () => buildYvUsdVaultsModel({ baseVault: buildSyntheticBaseVault() })
}))
vi.mock('@shared/contexts/useWallet', () => ({
  useWalletTokens: () => ({ getToken: () => ({ value: 0 }), getBalance: () => ({ raw: 0n, normalized: 0 }) }),
  useWalletHoldings: () => ({ getVaultHoldingsUsd: () => 0 }),
  useWalletStatus: () => ({ isLoading: false })
}))
const emptyFilter = () => ({
  filteredVaults: [],
  holdingsVaults: [],
  availableVaults: [],
  vaultFlags: {},
  underlyingAssetVaults: {},
  isLoading: false
})
vi.mock('@shared/hooks/useV3VaultFilter', () => ({ useV3VaultFilter: () => emptyFilter() }))
vi.mock('@shared/hooks/useV2VaultFilter', () => ({ useV2VaultFilter: () => emptyFilter() }))

afterEach(cleanup)

const defaultArgs: Parameters<typeof useVaultsListModel>[0] = {
  listVaultType: 'all',
  listChains: null,
  listV3Types: [],
  listCategories: null,
  listAggressiveness: null,
  listUnderlyingAssets: null,
  listFeeStructureKey: null,
  listMinTvl: 0,
  listShowLegacyVaults: false,
  listShowHiddenVaults: false,
  searchValue: 'yvUSD',
  sortBy: 'none',
  sortDirection: 'desc',
  isAvailablePinned: false
}

it.each(['all', 'v3'] as const)('pins new yvUSD and keeps Legacy yvUSD unpinned in %s', (listVaultType) => {
  const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, listVaultType }))
  expect(result.current.pinnedVaults.map((vault) => vault.address)).toEqual([YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed])
  expect(result.current.mainVaults.map((vault) => vault.name)).toContain('yvUSD Junior')
  expect(result.current.availableVaults.map((vault) => vault.name)).toContain('yvUSD')
  expect(result.current.mainVaults.some((vault) => vault.address === YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed)).toBe(
    false
  )
  expect(result.current.mainVaults.find((vault) => vault.address === YVUSD_UNLOCKED_ADDRESS)?.name).toBe('Legacy yvUSD')
})

it.each(['tvl', 'estAPY', 'deposited'] as const)('honors explicit %s sorting without the product pin', (sortBy) => {
  const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, sortBy }))
  expect(result.current.pinnedVaults).toEqual([])
  expect(result.current.mainVaults.some((vault) => vault.address === YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed)).toBe(
    true
  )
})

it.each([{ searchValue: 'Junior' }, { listChains: [8453] }, { listMinTvl: 13_000_000 }])(
  'does not pin yvUSD when excluded by $searchValue $listChains $listMinTvl',
  (filters) => {
    const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, ...filters }))
    expect(result.current.pinnedVaults).toEqual([])
  }
)

it('does not duplicate yvUSD when Available to Deposit is also pinned', () => {
  const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, isAvailablePinned: true }))
  const visibleVaults = [...result.current.pinnedVaults, ...result.current.mainVaults]
  expect(result.current.pinnedSections[0].key).toBe('yvUSD')
  expect(visibleVaults.filter((vault) => vault.address === YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed)).toHaveLength(1)
})
