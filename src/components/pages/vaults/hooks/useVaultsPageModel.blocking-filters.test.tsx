import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { useVaultsListModelMock, useVaultsQueryStateMock } = vi.hoisted(() => ({
  useVaultsListModelMock: vi.fn(),
  useVaultsQueryStateMock: vi.fn()
}))

const HIDDEN_ZERO_TVL_VAULT = {
  key: '1:0x0000000000000000000000000000000000000001',
  chainID: 1,
  listKind: 'factory',
  category: 'Volatile',
  aggressiveness: null,
  token: {
    symbol: 'OETH',
    name: 'Origin Ether'
  },
  info: {
    isHidden: false,
    riskLevel: 2
  },
  tvl: {
    tvl: 0
  }
}

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: undefined })
}))

vi.mock('@shared/hooks/useFetchYearnVaults', () => ({
  usePrefetchYearnVaults: vi.fn()
}))

vi.mock('@shared/hooks/useOptimisticValue', () => ({
  useOptimisticValue: (value: unknown) => [value, vi.fn()]
}))

vi.mock('@react-hookz/web', () => ({
  useMediaQuery: vi.fn(() => false)
}))

vi.mock('@shared/hooks/useVaultFilterUtils', () => ({
  getVaultKey: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.key
}))

vi.mock('@pages/vaults/domain/kongVaultSelectors', () => ({
  getVaultChainID: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.chainID,
  getVaultInfo: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.info,
  getVaultToken: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.token,
  getVaultTVL: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.tvl
}))

vi.mock('@pages/vaults/utils/vaultListFacets', () => ({
  deriveAssetCategory: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.category,
  deriveListKind: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.listKind,
  deriveV3Aggressiveness: (vault: typeof HIDDEN_ZERO_TVL_VAULT) => vault.aggressiveness,
  expandUnderlyingAssetSelection: (assets: string[]) => new Set(assets),
  getUnderlyingAssetLabel: (value: string) => value,
  normalizeUnderlyingAssetSymbol: (value?: string | null) => value || ''
}))

vi.mock('@pages/vaults/utils/vaultTypeUtils', () => ({
  getSupportedChainsForVaultType: vi.fn(() => [1])
}))

vi.mock('@pages/vaults/utils/chainSelection', () => ({
  resolveNextSingleChainSelection: vi.fn(() => null)
}))

vi.mock('./useVaultsQueryState', () => ({
  useVaultsQueryState: useVaultsQueryStateMock
}))

vi.mock('./useVaultsListModel', () => ({
  useVaultsListModel: useVaultsListModelMock
}))

import { useVaultsPageModel } from './useVaultsPageModel'

function renderHookState(): string {
  function HookState(): React.ReactNode {
    const model = useVaultsPageModel()
    return createElement(
      'pre',
      {},
      JSON.stringify({
        hiddenByFiltersCount: model.list.data.hiddenByFiltersCount,
        actionKeys: model.list.data.blockingFilterActions.map((action) => action.key)
      })
    )
  }

  return renderToStaticMarkup(createElement(HookState))
}

describe('useVaultsPageModel hidden min TVL recovery', () => {
  it('offers a clear minimum TVL action when search matches only zero-TVL vaults hidden by the default threshold', () => {
    useVaultsQueryStateMock.mockReturnValue({
      vaultType: 'all',
      hasTypesParam: false,
      search: 'oeth',
      types: ['multi', 'single'],
      categories: [],
      chains: null,
      aggressiveness: [],
      underlyingAssets: [],
      minTvl: 500,
      showLegacyVaults: false,
      showHiddenVaults: false,
      showStrategies: true,
      onSearch: vi.fn(),
      onChangeTypes: vi.fn(),
      onChangeCategories: vi.fn(),
      onChangeChains: vi.fn(),
      onChangeAggressiveness: vi.fn(),
      onChangeUnderlyingAssets: vi.fn(),
      onChangeMinTvl: vi.fn(),
      onChangeShowLegacyVaults: vi.fn(),
      onChangeShowHiddenVaults: vi.fn(),
      onChangeShowStrategies: vi.fn(),
      onChangeVaultType: vi.fn(),
      onChangeSortBy: vi.fn(),
      onChangeSortDirection: vi.fn(),
      onResetMultiSelect: vi.fn(),
      onResetExtraFilters: vi.fn(),
      onShareFilters: vi.fn(),
      sortBy: 'tvl',
      sortDirection: 'desc'
    })

    useVaultsListModelMock.mockImplementation(
      (args: {
        searchValue: string
        listMinTvl: number
        listShowLegacyVaults: boolean
        listShowHiddenVaults: boolean
      }) => {
        const baseResult = {
          listCategoriesSanitized: [],
          holdingsVaults: [],
          availableVaults: [],
          vaultFlags: {},
          underlyingAssetVaults: {},
          pinnedSections: [],
          pinnedVaults: [],
          mainVaults: [],
          suggestedVaults: [],
          totalMatchingVaults: 0,
          totalHoldingsMatching: 0,
          isLoadingVaultList: false
        }

        if (
          args.searchValue === 'oeth' &&
          args.listMinTvl === 0 &&
          args.listShowLegacyVaults === false &&
          args.listShowHiddenVaults === false
        ) {
          return {
            ...baseResult,
            mainVaults: [HIDDEN_ZERO_TVL_VAULT],
            totalMatchingVaults: 1
          }
        }

        if (
          args.searchValue === 'oeth' &&
          args.listMinTvl === 0 &&
          args.listShowLegacyVaults === true &&
          args.listShowHiddenVaults === true
        ) {
          return {
            ...baseResult,
            mainVaults: [HIDDEN_ZERO_TVL_VAULT],
            totalMatchingVaults: 1
          }
        }

        return baseResult
      }
    )

    const html = renderHookState()

    expect(html).toContain('&quot;hiddenByFiltersCount&quot;:1')
    expect(html).toContain('clearMinTvl')
  })
})
