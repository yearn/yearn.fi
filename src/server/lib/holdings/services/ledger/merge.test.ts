import { describe, expect, it } from 'vitest'
import { mergeLedgerStreams, type TLedgerAuthoritativeWindow } from '@/server/lib/holdings/services/ledger/merge'
import {
  LEDGER_STREAMS,
  type TLedgerSixStreams,
  type TLedgerTransferSourceEvent,
  type TLedgerV3DepositSourceEvent
} from '@/server/lib/holdings/services/ledger/types'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'

function emptyStreams(overrides: Partial<TLedgerSixStreams> = {}): TLedgerSixStreams {
  return {
    v3Deposits: [],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: [],
    ...overrides
  }
}

function deposit(id: string, blockNumber: number, assets = '1'): TLedgerV3DepositSourceEvent {
  return {
    id,
    vaultAddress: ADDRESS,
    chainId: 1,
    blockNumber,
    blockTimestamp: blockNumber * 10,
    logIndex: 0,
    transactionHash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
    transactionFrom: OTHER_ADDRESS,
    owner: ADDRESS,
    sender: OTHER_ADDRESS,
    assets,
    shares: '1'
  }
}

function transfer(id: string, blockNumber: number): TLedgerTransferSourceEvent {
  return {
    id,
    vaultAddress: ADDRESS,
    chainId: 1,
    blockNumber,
    blockTimestamp: blockNumber * 10,
    logIndex: 0,
    transactionHash: `0x${(blockNumber + 100).toString(16).padStart(64, '0')}`,
    transactionFrom: ADDRESS,
    sender: ADDRESS,
    receiver: ADDRESS,
    value: '1'
  }
}

function windows(lowerBlock: number, upperBlock: number): TLedgerAuthoritativeWindow[] {
  return LEDGER_STREAMS.map((stream) => ({ stream, chainId: 1, lowerBlock, upperBlock }))
}

describe('mergeLedgerStreams', () => {
  it('replaces the authoritative window while retaining older records', () => {
    const unchanged = deposit('unchanged', 20)
    const result = mergeLedgerStreams({
      cached: emptyStreams({
        v3Deposits: [deposit('old', 5), unchanged, deposit('deleted', 30), deposit('corrected', 40)]
      }),
      fetched: emptyStreams({
        v3Deposits: [unchanged, deposit('corrected', 40, '2'), deposit('added', 50)]
      }),
      windows: windows(10, 100)
    })

    expect(result.streams.v3Deposits.map((event) => event.id)).toEqual(['old', 'unchanged', 'corrected', 'added'])
    expect(result.stats.v3Deposits).toEqual({
      cached: 4,
      fetched: 3,
      added: 1,
      replaced: 1,
      deleted: 1,
      total: 4
    })
    expect(result.earliestChangedTimestamp).toBe(300)
    expect(result.latestCachedTimestamp).toBe(400)
  })

  it('keeps transfer-in and transfer-out memberships for a self-transfer', () => {
    const selfTransfer = transfer('self', 20)
    const result = mergeLedgerStreams({
      cached: emptyStreams(),
      fetched: emptyStreams({ transfersIn: [selfTransfer], transfersOut: [selfTransfer] }),
      windows: windows(0, 100)
    })

    expect(result.streams.transfersIn).toEqual([selfTransfer])
    expect(result.streams.transfersOut).toEqual([selfTransfer])
    expect(result.stats.transfersIn.added).toBe(1)
    expect(result.stats.transfersOut.added).toBe(1)
  })

  it('rejects partial windows, out-of-window rows, and conflicting identities', () => {
    const partialWindows = windows(0, 100).filter((window) => window.stream !== 'v3Deposits')
    expect(() =>
      mergeLedgerStreams({ cached: emptyStreams(), fetched: emptyStreams(), windows: partialWindows })
    ).toThrow(/every synchronized stream/i)
    expect(() =>
      mergeLedgerStreams({
        cached: emptyStreams(),
        fetched: emptyStreams({ v3Deposits: [deposit('outside', 101)] }),
        windows: windows(0, 100)
      })
    ).toThrow(/outside/i)
    expect(() =>
      mergeLedgerStreams({
        cached: emptyStreams(),
        fetched: emptyStreams({ v3Deposits: [deposit('duplicate', 20), deposit('duplicate', 20, '2')] }),
        windows: windows(0, 100)
      })
    ).toThrow(/conflicting/i)
  })
})
