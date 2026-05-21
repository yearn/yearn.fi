import type { TNotification } from '@shared/types/notifications'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockWeb3State } = vi.hoisted(() => ({
  mockWeb3State: { address: undefined as `0x${string}` | undefined }
}))

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: mockWeb3State.address })
}))

let getActivePortfolioActivityFacetState: typeof import('./usePortfolioActivity').getActivePortfolioActivityFacetState
let mergePortfolioActivityFacetState: typeof import('./usePortfolioActivity').mergePortfolioActivityFacetState
let getUnresolvedLocalActivityEntries: typeof import('./usePortfolioActivity').getUnresolvedLocalActivityEntries

beforeAll(async () => {
  const portfolioActivityModule = await import('./usePortfolioActivity')
  getActivePortfolioActivityFacetState = portfolioActivityModule.getActivePortfolioActivityFacetState
  mergePortfolioActivityFacetState = portfolioActivityModule.mergePortfolioActivityFacetState
  getUnresolvedLocalActivityEntries = portfolioActivityModule.getUnresolvedLocalActivityEntries
})

beforeEach(() => {
  mockWeb3State.address = undefined
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

describe('portfolio activity facet state', () => {
  it('ignores previous-wallet facet chains when the active wallet changes', () => {
    const walletAFacetState = {
      address: walletA,
      offsetPerSource: 500,
      discoveredChainIds: [1, 10],
      isScanComplete: true
    }

    expect(getActivePortfolioActivityFacetState(walletAFacetState, walletB)).toEqual({
      address: walletB,
      offsetPerSource: 0,
      discoveredChainIds: null,
      isScanComplete: false
    })
  })

  it('merges facet pages into the active wallet state only', () => {
    const walletAFacetState = {
      address: walletA,
      offsetPerSource: 500,
      discoveredChainIds: [1],
      isScanComplete: false
    }

    expect(mergePortfolioActivityFacetState(walletAFacetState, walletB, [10], null)).toEqual({
      address: walletB,
      offsetPerSource: 0,
      discoveredChainIds: [10],
      isScanComplete: true
    })

    expect(mergePortfolioActivityFacetState(walletAFacetState, walletA, [10, 1], 1000)).toEqual({
      address: walletA,
      offsetPerSource: 1000,
      discoveredChainIds: [1, 10],
      isScanComplete: false
    })
  })
})
