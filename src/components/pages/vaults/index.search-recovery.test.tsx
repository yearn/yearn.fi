import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { useVaultsPageModelMock } = vi.hoisted(() => ({
  useVaultsPageModelMock: vi.fn()
}))

const MOCK_VAULT = {
  key: '1:0x0000000000000000000000000000000000000001',
  chainID: 1
}

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

vi.mock('@pages/vaults/components/compare/VaultsCompareModal', () => ({
  VaultsCompareModal: () => <div>{'compare-modal'}</div>
}))

vi.mock('@pages/vaults/components/filters/VaultsFiltersBar', () => ({
  VaultsFiltersBar: () => <div>{'filters-bar'}</div>
}))

vi.mock('@pages/vaults/components/filters/VaultsFiltersPanel', () => ({
  VaultsFiltersPanel: () => <div>{'filters-panel'}</div>
}))

vi.mock('@pages/vaults/components/filters/VaultVersionToggle', () => ({
  VaultVersionToggle: () => <div>{'vault-version-toggle'}</div>
}))

vi.mock('@pages/vaults/components/list/VaultsAuxiliaryList', () => ({
  VaultsAuxiliaryList: () => <div>{'aux-list'}</div>
}))

vi.mock('@pages/vaults/components/list/VaultsListEmpty', () => ({
  VaultsListEmpty: () => <div>{'empty-list'}</div>
}))

vi.mock('@pages/vaults/components/list/VaultsListHead', () => ({
  VaultsListHead: () => <div>{'list-head'}</div>
}))

vi.mock('@pages/vaults/components/list/VaultsListRow', () => ({
  VaultsListRow: () => <div>{'vault-row'}</div>
}))

vi.mock('@pages/vaults/components/list/VaultsListRowSkeleton', () => ({
  VaultsListRowSkeleton: () => <div>{'vault-row-skeleton'}</div>
}))

vi.mock('@pages/vaults/components/list/VirtualizedVaultsList', () => ({
  VirtualizedVaultsList: ({
    items,
    getItemKey,
    renderItem
  }: {
    items: unknown[]
    getItemKey: (item: unknown, index: number) => string
    renderItem: (item: unknown, index: number) => React.ReactNode
  }) => (
    <div>
      {items.map((item, index) => (
        <div key={getItemKey(item, index)}>{renderItem(item, index)}</div>
      ))}
    </div>
  )
}))

vi.mock('@pages/vaults/components/tour/VaultsWelcomeTour', () => ({
  VaultsWelcomeTour: () => <div>{'welcome-tour'}</div>
}))

vi.mock('@pages/vaults/domain/kongVaultSelectors', () => ({
  getVaultChainID: (vault: typeof MOCK_VAULT) => vault.chainID
}))

vi.mock('@pages/vaults/utils/constants', () => ({
  toggleInArray: (current: string[], next: string) =>
    current.includes(next) ? current.filter((entry) => entry !== next) : [...current, next]
}))

vi.mock('@shared/components/Breadcrumbs', () => ({
  Breadcrumbs: () => <div>{'breadcrumbs'}</div>
}))

vi.mock('@shared/components/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button type={'button'}>{children}</button>
}))

vi.mock('@shared/hooks/useVaultFilterUtils', () => ({
  getVaultKey: (vault: typeof MOCK_VAULT) => vault.key
}))

vi.mock('@shared/icons/IconGitCompare', () => ({
  IconGitCompare: () => <div>{'compare-icon'}</div>
}))

vi.mock('@shared/utils', () => ({
  cl: (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@shared/utils/plausible', () => ({
  PLAUSIBLE_EVENTS: {
    FILTER_SEARCH: 'FILTER_SEARCH',
    COMPARE_VAULT_ADD: 'COMPARE_VAULT_ADD',
    COMPARE_MODAL_OPEN: 'COMPARE_MODAL_OPEN',
    COMPARE_MODE_TOGGLE: 'COMPARE_MODE_TOGGLE'
  }
}))

vi.mock('./hooks/useVaultsPageModel', () => ({
  useVaultsPageModel: useVaultsPageModelMock
}))

import Index from './index'

describe('Vaults page search recovery row', () => {
  it('renders a bottom recovery row when search results exist but more matching vaults are filtered out', () => {
    useVaultsPageModelMock.mockReturnValue({
      refs: {
        varsRef: { current: null },
        filtersRef: { current: null }
      },
      filtersBar: {
        search: { value: 'frx', onChange: vi.fn() },
        filters: { count: 0, sections: [], config: {}, initialState: {}, onApply: vi.fn(), onClear: vi.fn() },
        chains: { selected: null, onChange: vi.fn(), config: {} },
        shouldStackFilters: false,
        activeVaultType: 'all',
        onChangeVaultType: vi.fn()
      },
      list: {
        listHeadProps: {},
        listVaultType: 'all',
        shouldCollapseChips: false,
        displayedShowStrategies: true,
        activeFilters: {
          activeChains: [],
          activeCategories: [],
          activeProductType: 'all'
        },
        data: {
          isLoading: false,
          pinnedSections: [],
          pinnedVaults: [],
          mainVaults: [MOCK_VAULT],
          vaultFlags: { [MOCK_VAULT.key]: {} },
          listChains: null,
          totalMatchingVaults: 1,
          hiddenByFiltersCount: 2,
          blockingFilterActions: [
            {
              key: 'clearMinTvl',
              label: 'Clear minimum TVL',
              additionalResults: 2,
              onApply: vi.fn()
            }
          ]
        },
        handlers: {
          onToggleChain: vi.fn(),
          onToggleCategory: vi.fn(),
          onToggleType: vi.fn(),
          onToggleVaultType: vi.fn()
        },
        onResetFilters: vi.fn(),
        resolveApyDisplayVariant: vi.fn(() => 'default')
      }
    })

    const html = renderToStaticMarkup(<Index />)

    expect(html).toContain('Show additional matching vaults hidden by filters.')
    expect(html).not.toContain('Show 2 more matching vaults')
    expect(html).toContain('Clear minimum TVL (+2)')
  })
})
