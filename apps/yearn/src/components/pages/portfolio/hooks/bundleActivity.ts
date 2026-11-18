import type { TPortfolioActivityEntry, TPortfolioActivityResponse } from '@pages/portfolio/types/api'
import type { Address } from 'viem'

type TWalletActivityCursor = {
  wallet: Address
  nextOffset: number | null
  entries: TPortfolioActivityEntry[]
}

const MAX_CONCURRENT_REQUESTS = 3

export async function mapActivityWallets<T, TResult>(values: T[], fetchValue: (value: T) => Promise<TResult>) {
  return Array.from({ length: Math.ceil(values.length / MAX_CONCURRENT_REQUESTS) }).reduce<Promise<TResult[]>>(
    async (previous, _, index) => {
      const results = await previous
      const start = index * MAX_CONCURRENT_REQUESTS
      const next = await Promise.all(values.slice(start, start + MAX_CONCURRENT_REQUESTS).map(fetchValue))
      return results.concat(next)
    },
    Promise.resolve([])
  )
}

export function initialBundleActivityCursor(wallets: readonly Address[]): TWalletActivityCursor[] {
  return wallets.map((wallet) => ({ wallet, nextOffset: 0, entries: [] }))
}

export async function getBundleActivityPage(
  cursors: TWalletActivityCursor[],
  limit: number,
  fetchPage: (wallet: Address, offset: number) => Promise<TPortfolioActivityResponse>
) {
  async function fill(cursor: TWalletActivityCursor): Promise<TWalletActivityCursor> {
    const { wallet, nextOffset, entries } = cursor
    if (nextOffset === null || entries.length >= limit) return cursor

    const page = await fetchPage(wallet, nextOffset)
    if (page.pageInfo.nextOffset !== null && page.pageInfo.nextOffset <= nextOffset) {
      throw new Error('Activity pagination did not advance.')
    }

    return fill({
      wallet,
      nextOffset: page.pageInfo.nextOffset,
      entries: entries.concat(page.entries.map((entry) => ({ ...entry, wallet })))
    })
  }

  // A stream needs enough rows to provide the entire next page if its activity is newest.
  const buffers = await mapActivityWallets(cursors, fill)
  const entries = buffers
    .flatMap((cursor) => cursor.entries)
    .toSorted((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
  const consumed = new Set(entries)
  const nextCursors = buffers.map((cursor) => ({
    ...cursor,
    entries: cursor.entries.filter((entry) => !consumed.has(entry))
  }))
  return {
    entries,
    nextPage: nextCursors.some(({ nextOffset, entries }) => nextOffset !== null || entries.length > 0)
      ? nextCursors
      : undefined
  }
}
