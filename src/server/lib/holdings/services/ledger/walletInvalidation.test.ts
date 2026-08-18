import { afterEach, describe, expect, it } from 'vitest'
import {
  appendWalletLedgerInvalidation,
  getWalletLedgerInvalidationLogKey,
  readPendingWalletLedgerInvalidations,
  readWalletLedgerInvalidationHead,
  type TWalletLedgerInvalidationRedis
} from '@/server/lib/holdings/services/ledger/walletInvalidation'

const VAULT_A = '0x1111111111111111111111111111111111111111'
const VAULT_B = '0x2222222222222222222222222222222222222222'

class FakeInvalidationRedis implements TWalletLedgerInvalidationRedis {
  readonly lists = new Map<string, unknown[]>()

  llen(key: string): Promise<number> {
    return Promise.resolve(this.lists.get(key)?.length ?? 0)
  }

  lrange<TData>(key: string, start: number, end: number): Promise<TData[]> {
    const values = this.lists.get(key) ?? []
    const resolvedEnd = end < 0 ? values.length + end : end
    return Promise.resolve(values.slice(start, resolvedEnd + 1) as TData[])
  }

  rpush<TData>(key: string, ...elements: TData[]): Promise<number> {
    const values = this.lists.get(key) ?? []
    values.push(...elements)
    this.lists.set(key, values)
    return Promise.resolve(values.length)
  }
}

describe('wallet ledger invalidation log', () => {
  afterEach(() => {
    delete process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
  })

  it('appends normalized records and reads only sequences after the wallet cursor', async () => {
    const redis = new FakeInvalidationRedis()
    await expect(
      appendWalletLedgerInvalidation({
        redis,
        createdAtMs: 100,
        vaults: [
          { chainId: 10, address: VAULT_B, fromBlock: 200 },
          { chainId: 1, address: VAULT_A.toUpperCase().replace('0X', '0x'), fromBlock: 50 },
          { chainId: 1, address: VAULT_A, fromBlock: 40 }
        ]
      })
    ).resolves.toBe(1)
    await appendWalletLedgerInvalidation({
      redis,
      createdAtMs: 200,
      vaults: [{ chainId: 1, address: VAULT_B, fromBlock: 80 }]
    })

    await expect(readWalletLedgerInvalidationHead({ redis })).resolves.toBe(2)
    await expect(readPendingWalletLedgerInvalidations({ redis, appliedSequence: 1 })).resolves.toEqual({
      status: 'ready',
      headSequence: 2,
      records: [
        {
          schemaVersion: 1,
          createdAtMs: 200,
          vaults: [{ chainId: 1, address: VAULT_B, fromBlock: 80 }]
        }
      ]
    })
    await expect(readPendingWalletLedgerInvalidations({ redis, appliedSequence: 0 })).resolves.toMatchObject({
      status: 'ready',
      headSequence: 2,
      records: [
        {
          vaults: [
            { chainId: 1, address: VAULT_A, fromBlock: 40 },
            { chainId: 10, address: VAULT_B, fromBlock: 200 }
          ]
        },
        { vaults: [{ chainId: 1, address: VAULT_B, fromBlock: 80 }] }
      ]
    })
  })

  it('fails closed when the wallet cursor is ahead of the retained log', async () => {
    const redis = new FakeInvalidationRedis()

    await expect(readPendingWalletLedgerInvalidations({ redis, appliedSequence: 1 })).resolves.toEqual({
      status: 'gap',
      headSequence: 0
    })
  })

  it('namespaces the global log consistently with wallet ledger keys', () => {
    expect(getWalletLedgerInvalidationLogKey()).toBe('holdings:wallet-ledger-invalidations:v1')
    process.env.HOLDINGS_LEDGER_KEY_NAMESPACE = 'test_1'
    expect(getWalletLedgerInvalidationLogKey()).toBe('holdings:wallet-ledger-invalidations:v1:namespace:test_1')
  })
})
