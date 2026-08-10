import { describe, expect, it } from 'vitest'
import { resolveNextSingleChainSelection } from './chainSelection'

describe('resolveNextSingleChainSelection', () => {
  it('selects the requested chain when nothing is selected', () => {
    expect(resolveNextSingleChainSelection(null, 1)).toEqual([1])
    expect(resolveNextSingleChainSelection([], 10)).toEqual([10])
  })

  it('switches directly to the requested chain', () => {
    expect(resolveNextSingleChainSelection([1], 10)).toEqual([10])
    expect(resolveNextSingleChainSelection([1, 10], 42161)).toEqual([42161])
  })

  it('clears the filter when reselecting the only active chain', () => {
    expect(resolveNextSingleChainSelection([1], 1)).toBeNull()
  })
})
