import { describe, expect, it } from 'vitest'
import { hasInfinifiPoints } from './useYvUsdPoints'

describe('hasInfinifiPoints', () => {
  it('returns true when a points strategy has positive debt', () => {
    expect(
      hasInfinifiPoints({
        address: '0x696d02Db93291651ED510704c9b286841d506987',
        meta: {
          strategies: [
            {
              address: '0x5f9DBa2805411a8382FDb4E69d4f2Da8EFaF1F89',
              points: true,
              debt: '1'
            }
          ]
        }
      } as const)
    ).toBe(true)
  })

  it('returns false when a points strategy has no current debt', () => {
    expect(
      hasInfinifiPoints({
        address: '0x696d02Db93291651ED510704c9b286841d506987',
        meta: {
          strategies: [
            {
              address: '0x5f9DBa2805411a8382FDb4E69d4f2Da8EFaF1F89',
              points: true,
              debt: '0'
            }
          ]
        }
      } as const)
    ).toBe(false)
  })

  it('returns false when debt is positive but the strategy does not earn points', () => {
    expect(
      hasInfinifiPoints({
        address: '0x696d02Db93291651ED510704c9b286841d506987',
        meta: {
          strategies: [
            {
              address: '0x5f9DBa2805411a8382FDb4E69d4f2Da8EFaF1F89',
              points: false,
              debt: '10'
            }
          ]
        }
      } as const)
    ).toBe(false)
  })
})
