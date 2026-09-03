import {
  MAX_YBOLD_WALLET_ACTIVITIES,
  parseYboldWalletActivities,
  prependYboldWalletActivity,
  selectRecentYboldWalletActivities,
  type TYboldWalletActivity,
  updateYboldWalletActivity
} from '@ybold/lib/walletActivity'
import type { Address, Hash } from 'viem'
import { describe, expect, it } from 'vitest'

const OWNER = '0x1111111111111111111111111111111111111111' as Address
const OTHER_OWNER = '0x2222222222222222222222222222222222222222' as Address

const activity = (overrides: Partial<TYboldWalletActivity> = {}): TYboldWalletActivity => ({
  amount: '10',
  chainId: 1,
  createdAt: 100,
  fromSymbol: 'BOLD',
  id: 'activity-1',
  ownerAddress: OWNER,
  status: 'pending',
  type: 'deposit',
  ...overrides
})

describe('yBOLD wallet activity', () => {
  it('keeps the newest unique activities within the storage limit', () => {
    const existing = Array.from({ length: MAX_YBOLD_WALLET_ACTIVITIES }, (_, index) =>
      activity({ id: `activity-${index}`, createdAt: index })
    )
    const next = prependYboldWalletActivity(existing, activity({ id: 'new-activity', createdAt: 1_000 }))

    expect(next).toHaveLength(MAX_YBOLD_WALLET_ACTIVITIES)
    expect(next[0]?.id).toBe('new-activity')
    expect(new Set(next.map(({ id }) => id)).size).toBe(MAX_YBOLD_WALLET_ACTIVITIES)
  })

  it('records final status, hash, and completion time', () => {
    const txHash = `0x${'a'.repeat(64)}` as Hash
    const [updated] = updateYboldWalletActivity([activity()], { id: 'activity-1', status: 'success', txHash }, 500)

    expect(updated).toMatchObject({ finishedAt: 500, status: 'success', txHash })
  })

  it('selects only the active wallet and sorts recent entries', () => {
    const selected = selectRecentYboldWalletActivities(
      [
        activity({ id: 'older', createdAt: 100 }),
        activity({ id: 'other', createdAt: 500, ownerAddress: OTHER_OWNER }),
        activity({ id: 'newer', createdAt: 300 })
      ],
      OWNER
    )

    expect(selected.map(({ id }) => id)).toEqual(['newer', 'older'])
  })

  it('rejects malformed persisted data without failing the account menu', () => {
    expect(parseYboldWalletActivities('{not-json')).toEqual([])
    expect(parseYboldWalletActivities(JSON.stringify([{ id: 'missing-fields' }, activity()]))).toEqual([activity()])
  })
})
