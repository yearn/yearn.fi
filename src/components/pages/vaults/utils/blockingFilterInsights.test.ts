import { describe, expect, it } from 'vitest'

import {
  getAdditionalResultsForCombo,
  getCommonBlockingKeys,
  shouldShowComboBlockingAction
} from './blockingFilterInsights'

type TKey = 'showAllChains' | 'showAllVaults' | 'clearMinTvl' | 'showAllCategories' | 'showStrategies'

describe('blockingFilterInsights', () => {
  it('derives common blockers and combo additions from combo-applied filters', () => {
    const hiddenBlockingKeys: TKey[][] = [
      ['showAllVaults', 'showAllChains'],
      ['showAllVaults', 'showAllChains', 'clearMinTvl'],
      ['showAllVaults', 'showAllChains', 'showAllCategories']
    ]

    const comboKeys = getCommonBlockingKeys(hiddenBlockingKeys)
    const comboAdditionalResults = getAdditionalResultsForCombo(hiddenBlockingKeys, comboKeys)

    expect(comboKeys).toEqual(['showAllVaults', 'showAllChains'])
    expect(comboAdditionalResults).toBe(1)
  })

  it('does not count hidden entries without detected blockers', () => {
    const comboAdditionalResults = getAdditionalResultsForCombo<TKey>(
      [[], ['showAllChains'], ['showAllChains', 'clearMinTvl']],
      ['showAllChains']
    )

    expect(comboAdditionalResults).toBe(1)
  })

  it('shows fallback combo action for a single common blocker when no individual actions are available', () => {
    const shouldShow = shouldShowComboBlockingAction<TKey>({
      hiddenByFiltersCount: 3,
      comboKeys: ['showAllChains'],
      actionableKeys: new Set<TKey>()
    })

    expect(shouldShow).toBe(true)
  })

  it('hides combo action when hidden results do not exist', () => {
    const shouldShow = shouldShowComboBlockingAction<TKey>({
      hiddenByFiltersCount: 0,
      comboKeys: ['showAllChains'],
      actionableKeys: new Set<TKey>()
    })

    expect(shouldShow).toBe(false)
  })

  it('hides combo action when all combo keys are already individually actionable', () => {
    const shouldShow = shouldShowComboBlockingAction<TKey>({
      hiddenByFiltersCount: 4,
      comboKeys: ['showAllChains', 'showStrategies'],
      actionableKeys: new Set<TKey>(['showAllChains', 'showStrategies'])
    })

    expect(shouldShow).toBe(false)
  })
})
