import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { VaultsListEmpty } from './VaultsListEmpty'

function renderEmptyState(overrides: Partial<ComponentProps<typeof VaultsListEmpty>> = {}): string {
  return renderToStaticMarkup(<VaultsListEmpty currentSearch={''} onReset={vi.fn()} isLoading={false} {...overrides} />)
}

describe('VaultsListEmpty', () => {
  it('renders blocking filter toggles and a search action when results are recoverable', () => {
    const html = renderEmptyState({
      currentSearch: 'USDC',
      hiddenByFiltersCount: 3,
      blockingFilterActions: [
        { key: 'showLegacyVaults', label: 'Show legacy vaults', additionalResults: 2, onApply: vi.fn() },
        { key: 'showStrategies', label: 'Show single asset strategies', additionalResults: 1, onApply: vi.fn() }
      ]
    })

    expect(html).toContain('No results for &quot;USDC&quot; with current filters.')
    expect(html).toContain('3 vaults found that are hidden by filters. Enable them below.')
    expect(html).toContain('Show legacy vaults (+2)')
    expect(html).toContain('Show single asset strategies (+1)')
    expect(html).toContain('Search')
    expect(html).not.toContain('Show all results')
  })

  it('renders vault-not-found copy when no recoverable results exist', () => {
    const html = renderEmptyState({
      currentSearch: 'NOT_A_VAULT',
      blockingFilterActions: []
    })

    expect(html).toContain('The vault &quot;NOT_A_VAULT&quot; does not exist')
    expect(html).not.toContain('Show all results')
  })

  it('renders combination filter actions without zero-result suffixes', () => {
    const html = renderEmptyState({
      currentSearch: 'ETH',
      hiddenByFiltersCount: 2,
      blockingFilterActions: [
        { key: 'showAllChains', label: 'Show all chains', additionalResults: 0, onApply: vi.fn() },
        { key: 'showAllCategories', label: 'Show all categories', additionalResults: 0, onApply: vi.fn() }
      ]
    })

    expect(html).toContain('Show all chains')
    expect(html).toContain('Show all categories')
    expect(html).not.toContain('Show all chains (+0)')
    expect(html).not.toContain('Show all categories (+0)')
  })
})
