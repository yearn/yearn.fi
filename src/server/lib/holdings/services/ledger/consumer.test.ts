import { afterEach, describe, expect, it, vi } from 'vitest'
import { processLedgerSourceEvents } from '@/server/lib/holdings/services/graphql'
import { filterLedgerSourceEventsForSnapshot } from '@/server/lib/holdings/services/ledger/consumer'
import type {
  TLedgerSixStreams,
  TLedgerTransferSourceEvent,
  TLedgerV3DepositSourceEvent
} from '@/server/lib/holdings/services/ledger/types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'

function createTransfer(overrides: Partial<TLedgerTransferSourceEvent> = {}): TLedgerTransferSourceEvent {
  return {
    id: 'transfer-1',
    vaultAddress: VAULT_ADDRESS,
    chainId: 1,
    blockNumber: 10,
    blockTimestamp: 100,
    logIndex: 1,
    transactionHash: '0xtransfer',
    transactionFrom: USER_ADDRESS,
    sender: ZERO_ADDRESS,
    receiver: USER_ADDRESS,
    value: '100',
    ...overrides
  }
}

function createDeposit(overrides: Partial<TLedgerV3DepositSourceEvent> = {}): TLedgerV3DepositSourceEvent {
  return {
    id: 'deposit-1',
    vaultAddress: VAULT_ADDRESS,
    chainId: 1,
    blockNumber: 20,
    blockTimestamp: 200,
    logIndex: 1,
    transactionHash: '0xdeposit',
    transactionFrom: USER_ADDRESS,
    owner: USER_ADDRESS,
    sender: USER_ADDRESS,
    assets: '100',
    shares: '100',
    ...overrides
  }
}

function createStreams(overrides: Partial<TLedgerSixStreams> = {}): TLedgerSixStreams {
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

describe('ledger event snapshot consumer', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('applies an inclusive cutoff to every raw stream before transfer classification', () => {
    const streams = createStreams({
      v3Deposits: [createDeposit()],
      transfersIn: [createTransfer()]
    })

    const early = processLedgerSourceEvents(filterLedgerSourceEventsForSnapshot(streams, 100))
    const late = processLedgerSourceEvents(filterLedgerSourceEventsForSnapshot(streams, 200))

    expect(early.deposits).toEqual([])
    expect(early.transfersIn).toHaveLength(1)
    expect(late.deposits).toHaveLength(1)
    expect(late.transfersIn).toEqual([])
  })

  it('excludes unsupported chains while preserving both directions of a self-transfer', () => {
    const selfTransfer = createTransfer({ sender: USER_ADDRESS, receiver: USER_ADDRESS })
    const unsupported = createTransfer({ id: 'unsupported', chainId: 999_999 })
    const filtered = filterLedgerSourceEventsForSnapshot(
      createStreams({
        transfersIn: [selfTransfer, unsupported],
        transfersOut: [selfTransfer, unsupported]
      }),
      100
    )

    expect(filtered.transfersIn.map(({ id }) => id)).toEqual(['transfer-1'])
    expect(filtered.transfersOut.map(({ id }) => id)).toEqual(['transfer-1'])
  })

  it('filters snapshot events to the explicitly configured ledger chain scope', () => {
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '10')
    const filtered = filterLedgerSourceEventsForSnapshot(
      createStreams({ transfersIn: [createTransfer({ chainId: 1 }), createTransfer({ id: 'optimism', chainId: 10 })] }),
      100
    )

    expect(filtered.transfersIn.map(({ id }) => id)).toEqual(['optimism'])
  })

  it('returns detached raw records for each materialization', () => {
    const source = createTransfer()
    const streams = createStreams({ transfersIn: [source] })
    const first = filterLedgerSourceEventsForSnapshot(streams, 100)
    const second = filterLedgerSourceEventsForSnapshot(streams, 100)

    expect(first.transfersIn[0]).not.toBe(source)
    expect(first.transfersIn[0]).not.toBe(second.transfersIn[0])
    expect(first).toEqual(second)
  })
})
