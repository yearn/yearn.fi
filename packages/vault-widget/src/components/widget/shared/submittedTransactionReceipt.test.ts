import { type TransactionReceipt, TransactionReceiptNotFoundError } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { getConfirmedTransactionReceipt } from './submittedTransactionReceipt'

const HASH = `0x${'a'.repeat(64)}` as const
const receipt = { blockNumber: 10n, status: 'success', transactionHash: HASH } as TransactionReceipt

describe('getConfirmedTransactionReceipt', () => {
  it('returns the receipt from the explicitly supplied chain client', async () => {
    const client = {
      getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
      getBlockNumber: vi.fn()
    }

    await expect(getConfirmedTransactionReceipt(client, HASH, 1)).resolves.toBe(receipt)
    expect(client.getTransactionReceipt).toHaveBeenCalledWith({ hash: HASH })
  })

  it('waits for the requested confirmation count', async () => {
    const client = {
      getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
      getBlockNumber: vi.fn().mockResolvedValueOnce(10n).mockResolvedValueOnce(11n)
    }

    await expect(getConfirmedTransactionReceipt(client, HASH, 2)).resolves.toBeNull()
    await expect(getConfirmedTransactionReceipt(client, HASH, 2)).resolves.toBe(receipt)
  })

  it('keeps polling while the transaction receipt is unavailable', async () => {
    const client = {
      getTransactionReceipt: vi.fn().mockRejectedValue(new TransactionReceiptNotFoundError({ hash: HASH })),
      getBlockNumber: vi.fn()
    }

    await expect(getConfirmedTransactionReceipt(client, HASH, 1)).resolves.toBeNull()
  })
})
