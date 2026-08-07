import { describe, expect, it } from 'vitest'
import { getEffectiveEnsoRequestSlippage } from './useSolverEnso'

describe('getEffectiveEnsoRequestSlippage', () => {
  it('uses one basis point for a zero-slippage cross-chain request', () => {
    expect(getEffectiveEnsoRequestSlippage(0, true)).toBe(1)
  })

  it('keeps zero slippage for a same-chain request', () => {
    expect(getEffectiveEnsoRequestSlippage(0, false)).toBe(0)
  })

  it('keeps positive requested slippage unchanged', () => {
    expect(getEffectiveEnsoRequestSlippage(37, true)).toBe(37)
    expect(getEffectiveEnsoRequestSlippage(37, false)).toBe(37)
  })
})
