// @vitest-environment jsdom

import { useVaultsPageModel } from '@pages/vaults/hooks/useVaultsPageModel'
import { act, memo } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

const { rowRender, router, enableVaultListFetch } = vi.hoisted(() => ({
  rowRender: vi.fn(),
  router: { replace: vi.fn() },
  enableVaultListFetch: vi.fn()
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/vaults',
  useRouter: () => router
}))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ address: undefined }) }))
vi.mock('@shared/contexts/useYearn', () => ({ useYearn: () => ({ enableVaultListFetch }) }))
vi.mock('@react-hookz/web', () => ({ useMediaQuery: () => false }))
vi.mock('@pages/vaults/components/filters/VaultsAssetFilter', () => ({ VaultsAssetFilter: () => null }))
vi.mock('@shared/components/TokenLogo', () => ({ TokenLogo: () => null }))
vi.mock('@pages/vaults/hooks/useVaultsListModel', () => ({
  useVaultsListModel: () => ({
    listCategoriesSanitized: [],
    availableVaults: [],
    vaultFlags: {},
    underlyingAssetVaults: {},
    pinnedSections: [],
    pinnedVaults: [],
    mainVaults: [],
    yvUsdVaults: {},
    totalMatchingVaults: 0,
    totalHoldingsMatching: 0,
    isLoadingVaultList: false,
    isWalletLoading: false,
    vaultHoldingsValues: {}
  })
}))

const Row = memo(function Row({ onToggleCategory }: { onToggleCategory: (category: string) => void }) {
  rowRender(onToggleCategory)
  return (
    <button type="button" onClick={() => onToggleCategory('Stablecoin')}>
      Toggle category
    </button>
  )
})

function Page() {
  const { list } = useVaultsPageModel()
  return (
    <>
      <Row onToggleCategory={list.handlers.onToggleCategory} />
      <output>{list.activeFilters.activeCategories.join(',')}</output>
    </>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  window.localStorage.clear()
})

it('keeps category callbacks stable across unrelated updates while preserving toggles and navigation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.history.replaceState(null, '', '/vaults')
  router.replace.mockImplementation((url: string) => window.history.replaceState(null, '', url))
  const container = document.createElement('div')
  const root = createRoot(container)

  try {
    await act(async () => root.render(<Page />))
    const initialCategoryCallback = rowRender.mock.calls.at(-1)?.[0]
    rowRender.mockClear()

    await act(async () => root.render(<Page />))
    expect(rowRender).not.toHaveBeenCalled()

    await act(async () => container.querySelector('button')?.click())
    expect(container.querySelector('output')?.textContent).toBe('Stablecoin')
    expect(new URLSearchParams(window.location.search).get('categories')).toBe('Stablecoin')

    await act(async () => container.querySelector('button')?.click())
    expect(container.querySelector('output')?.textContent).toBe('')
    expect(rowRender.mock.calls.at(-1)?.[0]).not.toBe(initialCategoryCallback)

    rowRender.mockClear()
    await act(async () => root.render(<Page />))
    expect(rowRender).not.toHaveBeenCalled()

    await act(async () => {
      window.history.replaceState(null, '', '/vaults?categories=Volatile')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('output')?.textContent).toBe('Volatile')

    await act(async () => {
      window.history.replaceState(null, '', '/vaults')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('output')?.textContent).toBe('')
  } finally {
    await act(async () => root.unmount())
  }
})
