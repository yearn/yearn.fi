import { YCRV_TOKEN_ADDRESS, YVCRVUSD_REWARD_ADDRESS } from '@pages/portfolio/ycrv/constants'
import { fetchYDaemonYcrvPrices, resolveYcrvPrices } from '@pages/portfolio/ycrv/ycrvPrices'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('resolveYcrvPrices', () => {
  it('uses yDaemon prices when the authenticated spot endpoint is unavailable', () => {
    expect(
      resolveYcrvPrices({
        fallbackPrices: { ycrvPrice: 0.14, rewardPrice: 1.15 },
        spotYcrvPrice: 0,
        spotRewardPrice: 0
      })
    ).toEqual({ ycrvPrice: 0.14, rewardPrice: 1.15 })
  })

  it('prefers the standard portfolio spot prices when available', () => {
    expect(
      resolveYcrvPrices({
        fallbackPrices: { ycrvPrice: 0.14, rewardPrice: 1.15 },
        spotYcrvPrice: 0.16,
        spotRewardPrice: 1.2
      })
    ).toEqual({ ycrvPrice: 0.16, rewardPrice: 1.2 })
  })
})

describe('fetchYDaemonYcrvPrices', () => {
  it('normalizes address casing in the yDaemon response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            [YCRV_TOKEN_ADDRESS.toUpperCase()]: 0.14,
            [YVCRVUSD_REWARD_ADDRESS]: 1.15
          })
        )
      )
    )

    await expect(fetchYDaemonYcrvPrices('https://ydaemon.example/1')).resolves.toEqual({
      ycrvPrice: 0.14,
      rewardPrice: 1.15
    })
  })
})
