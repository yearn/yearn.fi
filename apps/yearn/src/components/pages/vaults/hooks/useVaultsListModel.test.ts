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

it.each([
  ['senior', YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed],
  ['junior', YVUSD_TRANCHE_DEPLOYMENT.tranches.levered]
] as const)('shows only %s vaults while the seniority filter is active', (listSeniority, address) => {
  const { result, rerender } = renderHook<ReturnType<typeof useVaultsListModel>, typeof listSeniority | null>(
    (seniority) => useVaultsListModel({ ...defaultArgs, listSeniority: seniority }),
    { initialProps: listSeniority }
  )

  expect([...result.current.pinnedVaults, ...result.current.mainVaults].map((vault) => vault.address)).toEqual([
    address
  ])

  rerender(null)
  expect([...result.current.pinnedVaults, ...result.current.mainVaults].map((vault) => vault.address)).toContain(
    YVUSD_UNLOCKED_ADDRESS
  )
})

it('pins yvUSD Senior above yvETH Senior in the default view', () => {
  const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, searchValue: '' }))
  expect(result.current.pinnedVaults.map((vault) => vault.name)).toEqual(['yvUSD', 'yvETH'])
})

it.each(['tvl', 'estAPY', 'deposited'] as const)('sorts both Senior vaults without default pins for %s', (sortBy) => {
  const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, searchValue: '', sortBy }))
  expect(result.current.pinnedVaults).toEqual([])
  const seniorNames = result.current.mainVaults
    .map((vault) => vault.name)
    .filter((name) => name === 'yvUSD' || name === 'yvETH')
  expect(seniorNames).toEqual(sortBy === 'tvl' ? ['yvETH', 'yvUSD'] : ['yvUSD', 'yvETH'])
})

it.each([{ searchValue: 'Junior' }, { listChains: [8453] }, { listMinTvl: 13_000_000 }])(
  'does not pin yvUSD when excluded by $searchValue $listChains $listMinTvl',
  (filters) => {
    const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, ...filters }))
    expect(result.current.pinnedVaults).toEqual([])
  }
)

it('does not duplicate either Senior vault when Available to Deposit is also pinned', () => {
  const { result } = renderHook(() => useVaultsListModel({ ...defaultArgs, searchValue: '', isAvailablePinned: true }))
  const visibleVaults = [...result.current.pinnedVaults, ...result.current.mainVaults]
  expect(result.current.pinnedSections[0].vaults.map((vault) => vault.name)).toEqual(['yvUSD', 'yvETH'])
  expect(visibleVaults.filter((vault) => vault.name === 'yvUSD')).toHaveLength(1)
  expect(visibleVaults.filter((vault) => vault.name === 'yvETH')).toHaveLength(1)
})
