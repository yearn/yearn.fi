import type { TNotification } from '@shared/types/notifications'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: undefined })
}))

let getUnresolvedLocalActivityEntries: typeof import('./usePortfolioActivity').getUnresolvedLocalActivityEntries

beforeAll(async () => {
  getUnresolvedLocalActivityEntries = (await import('./usePortfolioActivity')).getUnresolvedLocalActivityEntries
})

const walletA = '0x000000000000000000000000000000000000000a'
const walletB = '0x000000000000000000000000000000000000000b'

const baseNotification: TNotification = {
  id: 1,
  type: 'deposit',
  address: walletA,
  chainId: 1,
  amount: '1 ETH',
  fromAddress: '0x0000000000000000000000000000000000000001',
  fromTokenName: 'ETH',
  status: 'submitted'
}

describe('getUnresolvedLocalActivityEntries', () => {
  it('returns only unresolved entries for the active wallet', () => {
    const entries: TNotification[] = [
      { ...baseNotification, id: 1, address: walletA, timeFinished: 1 },
      { ...baseNotification, id: 2, address: walletB, timeFinished: 3 },
      { ...baseNotification, id: 3, address: walletB, status: 'success', timeFinished: 4 }
    ]

    expect(getUnresolvedLocalActivityEntries(entries, walletB)).toEqual([
      { ...baseNotification, id: 2, address: walletB, timeFinished: 3 }
    ])
  })

  it('compares wallet addresses case-insensitively', () => {
    const uppercaseWalletA = walletA.toUpperCase() as `0x${string}`
    const entries: TNotification[] = [{ ...baseNotification, address: uppercaseWalletA }]

    expect(getUnresolvedLocalActivityEntries(entries, walletA)).toEqual([
      { ...baseNotification, address: uppercaseWalletA }
    ])
  })

  it('hides local entries when there is no active wallet address', () => {
    expect(getUnresolvedLocalActivityEntries([baseNotification], undefined)).toEqual([])
  })

  it('hides entries that do not have an address', () => {
    const entries = [{ ...baseNotification, address: undefined }] as unknown as TNotification[]

    expect(getUnresolvedLocalActivityEntries(entries, walletA)).toEqual([])
  })
})
