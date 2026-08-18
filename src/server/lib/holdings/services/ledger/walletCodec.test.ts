import { describe, expect, it } from 'vitest'
import { decodeWalletLedgerValue, encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  type TWalletLedgerPayloadV3,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'

const WALLET_HASH = 'a'.repeat(64)
const SOURCE_FINGERPRINT = 'b'.repeat(64)
const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'
const TRANSACTION_HASH = `0x${'c'.repeat(64)}`

function createPayload(overrides: Partial<TWalletLedgerPayloadV3> = {}): TWalletLedgerPayloadV3 {
  return {
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: 'wallet-ledger-test-v1',
    walletHash: WALLET_HASH,
    sourceFingerprint: SOURCE_FINGERPRINT,
    sourceGeneration: 1,
    appliedInvalidationSequence: 0,
    coverage: [{ chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 }],
    streams: {
      v3Deposits: [
        {
          id: 'deposit-1',
          vaultAddress: VAULT_ADDRESS,
          chainId: 1,
          blockNumber: 90,
          blockTimestamp: 900,
          logIndex: 1,
          transactionHash: TRANSACTION_HASH,
          transactionFrom: USER_ADDRESS,
          owner: USER_ADDRESS,
          sender: USER_ADDRESS,
          assets: '100',
          shares: '90'
        }
      ],
      v3Withdrawals: [],
      v2Deposits: [],
      v2Withdrawals: [],
      transfersIn: [],
      transfersOut: []
    },
    createdAtMs: 1_000,
    updatedAtMs: 2_000,
    reconciledAtMs: 1_500,
    ...overrides
  }
}

describe('one-value wallet ledger codec', () => {
  it('round-trips one canonical checksummed Brotli payload', () => {
    const encoded = encodeWalletLedgerPayload(createPayload())
    const decoded = decodeWalletLedgerValue(encoded.value, WALLET_HASH)

    expect(decoded).toEqual(encoded.ledger)
    expect(decoded.revision).toMatch(/^[a-f0-9]{64}$/)
    expect(encoded.value).toContain(`:${decoded.revision}:`)
    expect(decoded.streams.v3Deposits).toHaveLength(1)
  })

  it('rejects checksum corruption and a wallet-scoped read mismatch', () => {
    const encoded = encodeWalletLedgerPayload(createPayload())
    const parts = encoded.value.split(':')
    const revisionIndex = parts.indexOf(encoded.ledger.revision)
    const corrupted = parts
      .map((part, index) => (index === revisionIndex ? `${part.slice(0, -1)}${part.endsWith('0') ? '1' : '0'}` : part))
      .join(':')

    expect(() => decodeWalletLedgerValue(corrupted, WALLET_HASH)).toThrow(/checksum/i)
    expect(() => decodeWalletLedgerValue(encoded.value, 'd'.repeat(64))).toThrow(/another wallet/i)
  })

  it('rejects non-canonical duplicate events and events outside progress coverage', () => {
    const payload = createPayload()
    const deposit = payload.streams.v3Deposits[0]
    if (!deposit) {
      throw new Error('Expected deposit fixture')
    }

    expect(() =>
      encodeWalletLedgerPayload({
        ...payload,
        streams: { ...payload.streams, v3Deposits: [deposit, deposit] }
      })
    ).toThrow(/canonical, ordered, and unique/i)
    expect(() =>
      encodeWalletLedgerPayload({
        ...payload,
        streams: { ...payload.streams, v3Deposits: [{ ...deposit, blockNumber: 101 }] }
      })
    ).toThrow(/outside synchronized chain coverage/i)
  })

  it('requires unique canonically ordered per-chain progress coverage', () => {
    const payload = createPayload({
      coverage: [
        { chainId: 10, startBlock: 2, endBlock: null, completeThroughBlock: 200 },
        { chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 }
      ]
    })
    expect(() => encodeWalletLedgerPayload(payload)).toThrow(/canonical order/i)
    expect(() =>
      encodeWalletLedgerPayload({
        ...createPayload(),
        coverage: [
          { chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 },
          { chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 }
        ]
      })
    ).toThrow(/unique chains/i)
  })

  it('requires the last reconciliation timestamp to stay inside the ledger lifetime', () => {
    expect(() => encodeWalletLedgerPayload(createPayload({ reconciledAtMs: 999 }))).toThrow(/timestamps/i)
    expect(() => encodeWalletLedgerPayload(createPayload({ reconciledAtMs: 2_001 }))).toThrow(/timestamps/i)
  })
})
