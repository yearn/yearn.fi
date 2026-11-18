import { getBundleActivityPage, initialBundleActivityCursor } from '@pages/portfolio/hooks/bundleActivity'
import type { TPortfolioActivityResponse } from '@pages/portfolio/types/api'
import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const first = '0x1111111111111111111111111111111111111111'
const second = '0x2222222222222222222222222222222222222222'

function activityPage(
  address: Address,
  offset: number,
  nextOffset: number | null,
  timestamps: number[]
): TPortfolioActivityResponse {
  return {
    address,
    version: 'all',
    limit: 2,
    offset,
    pageInfo: { hasMore: nextOffset !== null, nextOffset },
    entries: timestamps.map((timestamp) => ({
      chainId: 1,
      txHash: `fixture-${timestamp}`,
      timestamp,
      action: 'deposit',
      transferDirection: null,
      displayType: null,
      vaultAddress: first,
      familyVaultAddress: first,
      assetSymbol: 'USDC',
      assetAmount: '0',
      shareAmount: '0',
      assetAmountFormatted: null,
      shareAmountFormatted: null,
      inputTokenAddress: null,
      inputTokenSymbol: null,
      inputTokenAmount: null,
      inputTokenAmountFormatted: null,
      outputTokenAddress: null,
      outputTokenSymbol: null,
      outputTokenAmount: null,
      outputTokenAmountFormatted: null,
      status: 'ok'
    }))
  }
}

describe('bundle activity pagination', () => {
  it('merges transactions in timestamp order across sparse wallet pages and retains each wallet', async () => {
    const load = vi.fn(async (wallet: Address, offset: number) => {
      if (wallet === first) return activityPage(wallet, offset, offset === 0 ? 2 : null, offset === 0 ? [9] : [6, 3])
      return activityPage(wallet, offset, offset === 0 ? 2 : null, offset === 0 ? [] : [8, 4, 2])
    })

    const page = await getBundleActivityPage(initialBundleActivityCursor([first, second]), 2, load)
    expect(page.entries.map(({ timestamp, wallet }) => [timestamp, wallet])).toEqual([
      [9, first],
      [8, second]
    ])
    const next = await getBundleActivityPage(page.nextPage!, 2, load)
    expect(next.entries.map(({ timestamp }) => timestamp)).toEqual([6, 4])
    const last = await getBundleActivityPage(next.nextPage!, 2, load)
    expect(last.entries.map(({ timestamp }) => timestamp)).toEqual([3, 2])
    expect(last.nextPage).toBeUndefined()
    expect(load.mock.calls).toHaveLength(4)
  })

  it('rejects an offset that does not advance', async () => {
    await expect(
      getBundleActivityPage(initialBundleActivityCursor([first]), 2, async () => activityPage(first, 0, 0, []))
    ).rejects.toThrow('Activity pagination did not advance.')
  })
})
