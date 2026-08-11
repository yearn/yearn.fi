import { describe, expect, it } from 'vitest'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  createWalletLedgerEventSource,
  filterWalletLedgerStreams
} from '@/server/lib/holdings/services/ledger/walletConsumer'
import { WALLET_LEDGER_SCHEMA_VERSION } from '@/server/lib/holdings/services/ledger/walletTypes'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'
const VAULT_ADDRESS = '0x3333333333333333333333333333333333333333'

function createLedger() {
  return encodeWalletLedgerPayload({
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: LEDGER_CALCULATION_VERSION,
    walletHash: hashLedgerWalletAddress(USER_ADDRESS),
    sourceFingerprint: 'a'.repeat(64),
    sourceGeneration: 2,
    coverage: [{ chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 }],
    streams: {
      v3Deposits: [
        {
          id: 'early',
          vaultAddress: VAULT_ADDRESS,
          chainId: 1,
          blockNumber: 10,
          blockTimestamp: 100,
          logIndex: 1,
          transactionHash: `0x${'a'.repeat(64)}`,
          transactionFrom: USER_ADDRESS,
          owner: USER_ADDRESS,
          sender: USER_ADDRESS,
          assets: '100',
          shares: '90'
        },
        {
          id: 'late',
          vaultAddress: VAULT_ADDRESS,
          chainId: 1,
          blockNumber: 20,
          blockTimestamp: 200,
          logIndex: 1,
          transactionHash: `0x${'b'.repeat(64)}`,
          transactionFrom: USER_ADDRESS,
          owner: USER_ADDRESS,
          sender: USER_ADDRESS,
          assets: '200',
          shares: '180'
        }
      ],
      v3Withdrawals: [],
      v2Deposits: [],
      v2Withdrawals: [],
      transfersIn: [],
      transfersOut: []
    },
    createdAtMs: 1_000,
    updatedAtMs: 2_000
  }).ledger
}

describe('wallet ledger event source', () => {
  it('filters the in-memory streams at an inclusive request cutoff', async () => {
    const ledger = createLedger()
    const source = createWalletLedgerEventSource({
      ledger,
      latestSettledDayTimestamp: 0,
      eventUpperTimestamp: 200
    })
    const events = await source.load({
      userAddress: USER_ADDRESS,
      version: 'all',
      maxTimestamp: 100,
      fetchType: 'seq',
      paginationMode: 'all'
    })

    expect(events.deposits.map(({ id }) => id)).toEqual(['early'])
    expect(source.key).toContain(ledger.revision)
  })

  it('rejects a different wallet and returns detached filtered records', async () => {
    const ledger = createLedger()
    const first = filterWalletLedgerStreams(ledger, 200)
    const second = filterWalletLedgerStreams(ledger, 200)
    const source = createWalletLedgerEventSource({
      ledger,
      latestSettledDayTimestamp: 0,
      eventUpperTimestamp: 200
    })

    expect(first.v3Deposits[0]).not.toBe(ledger.streams.v3Deposits[0])
    expect(first.v3Deposits[0]).not.toBe(second.v3Deposits[0])
    await expect(
      source.load({
        userAddress: OTHER_ADDRESS,
        version: 'all',
        fetchType: 'seq',
        paginationMode: 'all'
      })
    ).rejects.toThrow(/does not match/i)
  })
})
