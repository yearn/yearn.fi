import type { TGroupedMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { describe, expect, it, vi } from 'vitest'
import { mergeChainMerkleData } from './claimRewards.helpers'

describe('claimRewards helpers', () => {
  it('tracks initial empty loading states so the portfolio rewards view stays in loading mode', () => {
    const refetch = vi.fn()
    const next = mergeChainMerkleData({}, 747474, [] as TGroupedMerkleReward[], true, refetch)

    expect(next[747474]).toMatchObject({
      rewards: [],
      isLoading: true,
      refetch
    })
  })
})
