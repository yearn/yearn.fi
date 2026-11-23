import { describe, expect, it } from 'vitest'
import { getProductTypeDescription, getProductTypeLabel } from './vaultTagCopy'

describe('product type copy', () => {
  it('never calls a non-Yearn vault a Legacy Yearn vault', () => {
    expect(getProductTypeLabel('legacy')).toBe('Legacy')
    expect(getProductTypeLabel('legacy', true)).toBe('ERC-4626')
    expect(getProductTypeDescription('legacy')).toContain('Legacy Yearn vault architecture')
    expect(getProductTypeDescription('legacy', true)).toBe(
      'This ERC-4626 vault is not a Yearn vault. Yearn does not build or manage it.'
    )
  })
})
