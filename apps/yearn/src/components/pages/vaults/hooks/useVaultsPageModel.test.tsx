// @vitest-environment jsdom

import { useVaultsPageModel } from '@pages/vaults/hooks/useVaultsPageModel'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  address: undefined as string | undefined,
  allVaults: {} as Record<string, unknown>,
  isLoadingVaultList: false,
  replace: vi.fn(),
  enableVaultListFetch: vi.fn(),
  useVaultsListModel: vi.fn()
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/vaults',
  useRouter: () => ({ replace: mocks.replace })
}))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ address: mocks.address }) }))
vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: () => ({
    enableVaultListFetch: mocks.enableVaultListFetch,
    allVaults: mocks.allVaults,
    isLoadingVaultList: mocks.isLoadingVaultList
  })
}))
vi.mock('@react-hookz/web', () => ({ useMediaQuery: () => false }))
vi.mock('@pages/vaults/hooks/useVaultsListModel', () => ({
  useVaultsListModel: mocks.useVaultsListModel
}))

beforeEach(() => {
  mocks.address = undefined
  mocks.allVaults = {}
  mocks.isLoadingVaultList = false
  mocks.enableVaultListFetch.mockClear()
  mocks.useVaultsListModel.mockReset().mockImplementation(({ vaultSource }) => ({
    listCategoriesSanitized: [],
    availableVaults: [],
    vaultFlags: {},
    underlyingAssetVaults: {},
    pinnedSections: [],
    pinnedVaults: [],
    mainVaults: [],
    totalMatchingVaults: 0,
    totalHoldingsMatching: 0,
    isLoadingVaultList: vaultSource?.isLoadingVaultList ?? mocks.isLoadingVaultList,
    vaultHoldingsValues: {}
  }))
})

afterEach(cleanup)

it('keeps row category handlers stable across unrelated wallet updates, while category toggles still work', () => {
  const { result, rerender } = renderHook(() => useVaultsPageModel())
  const onToggleCategory = result.current.list.handlers.onToggleCategory
  mocks.address = '0x1111111111111111111111111111111111111111'
  rerender()
  expect(result.current.list.handlers.onToggleCategory).toBe(onToggleCategory)
  rerender()
  expect(result.current.list.handlers.onToggleCategory).toBe(onToggleCategory)
  act(() => result.current.list.handlers.onToggleCategory('Stablecoin'))
  expect(result.current.list.activeFilters.activeCategories).toEqual(['Stablecoin'])
  act(() => result.current.list.handlers.onToggleCategory('Stablecoin'))
  expect(result.current.list.activeFilters.activeCategories).toEqual([])
})

it('keeps the initial catalog visible through connection and hands over only when the full catalog is available', () => {
  const vaultAddress = '0x1111111111111111111111111111111111111111'
  const initialVaults = { vaults: [[vaultAddress, 1, '3.0.0']] }
  const { result, rerender } = renderHook(() => useVaultsPageModel(undefined, initialVaults))
  const initialSource = mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource
  expect(initialSource.vaults[vaultAddress]).toBeDefined()
  expect(mocks.enableVaultListFetch).not.toHaveBeenCalled()

  mocks.address = vaultAddress
  rerender()
  expect(mocks.enableVaultListFetch).toHaveBeenCalledOnce()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBe(initialSource)
  mocks.isLoadingVaultList = true
  rerender()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBe(initialSource)
  expect(result.current.list.data.isLoading).toBe(false)
  expect(result.current.list.data.hasWalletAddress).toBe(true)

  // An unsuccessful fetch also leaves the already-rendered catalog available.
  mocks.isLoadingVaultList = false
  rerender()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBe(initialSource)
  mocks.allVaults = initialSource.allVaults
  rerender()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBeUndefined()
  expect(result.current.list.data.isLoading).toBe(false)

  mocks.address = undefined
  rerender()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBe(initialSource)
  mocks.address = vaultAddress
  rerender()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBeUndefined()
})

it('still loads the full catalog when the initial server catalog is unavailable', () => {
  mocks.isLoadingVaultList = true
  const { result } = renderHook(() => useVaultsPageModel())
  expect(mocks.enableVaultListFetch).toHaveBeenCalledOnce()
  expect(mocks.useVaultsListModel.mock.lastCall?.[0].vaultSource).toBeUndefined()
  expect(result.current.list.data.isLoading).toBe(true)
})
