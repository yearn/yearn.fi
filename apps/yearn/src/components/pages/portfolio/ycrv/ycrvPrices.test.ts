import { YCRV_TOKEN_ADDRESS, YVCRVUSD_REWARD_ADDRESS } from '@pages/portfolio/ycrv/constants'
import { resolveYcrvPrices } from '@pages/portfolio/ycrv/ycrvPrices'
import { describe, expect, it } from 'vitest'

describe('resolveYcrvPrices', () => {
  it('reads both prices from the Price Service spot response envelope', () => {
    expect(
      resolveYcrvPrices({
        coins: {
          [`ethereum:${YCRV_TOKEN_ADDRESS.toLowerCase()}`]: { prices: [{ price: 0.14 }] },
          [`ethereum:${YVCRVUSD_REWARD_ADDRESS.toLowerCase()}`]: { prices: [{ price: 1.15 }] }
        }
      })
    ).toEqual({ ycrvPrice: 0.14, rewardPrice: 1.15 })
  })

  it('keeps missing or unavailable prices unknown', () => {
    expect(
      resolveYcrvPrices({
        coins: {
          [`ethereum:${YCRV_TOKEN_ADDRESS.toLowerCase()}`]: {
            prices: [],
            error: { code: 'NOT_FOUND', message: 'No price' }
          }
        }
      })
    ).toEqual({ ycrvPrice: null, rewardPrice: null })
  })
})
