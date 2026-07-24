import { describe, expect, it, vi } from 'vitest'
import { createHttpEnsoBridgeStatusProvider, normalizeEnsoBridgeStatus } from './ensoBridge'

const sourceTxHash = `0x${'1'.repeat(64)}` as const
const destinationTxHash = `0x${'2'.repeat(64)}` as const
const request = {
  destinationChainId: 8453,
  protocol: 'stargate' as const,
  sourceChainId: 1,
  sourceTxHash
}

describe('Enso bridge status', () => {
  it('normalizes a delivered bridge status and validates its route identity', () => {
    expect(
      normalizeEnsoBridgeStatus(
        {
          destinationChainId: 8453,
          destinationTxHash,
          sourceChainId: 1,
          sourceTxHash,
          status: 'delivered'
        },
        request
      )
    ).toEqual({
      destinationChainId: 8453,
      destinationTxHash,
      error: undefined,
      sourceChainId: 1,
      sourceTxHash,
      status: 'delivered'
    })
  })

  it('rejects status for a different source transaction', () => {
    expect(() =>
      normalizeEnsoBridgeStatus(
        {
          sourceTxHash: destinationTxHash,
          status: 'pending'
        },
        request
      )
    ).toThrow('different source transaction')
  })

  it('polls at the Enso rate limit until the bridge is delivered', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: 'inflight' }))
      .mockResolvedValueOnce(Response.json({ destinationTxHash, status: 'delivered' }))
    const waiter = vi.fn(async () => undefined)
    const onStatus = vi.fn()
    const provider = createHttpEnsoBridgeStatusProvider({
      fetcher,
      pollIntervalMs: 1,
      waiter
    })

    await expect(provider.waitForCompletion(request, onStatus)).resolves.toMatchObject({
      destinationTxHash,
      status: 'delivered'
    })
    expect(waiter).toHaveBeenCalledWith(10_000, undefined)
    expect(onStatus.mock.calls.map(([status]) => status.status)).toEqual(['inflight', 'delivered'])
  })

  it('surfaces a failed destination callback', async () => {
    const provider = createHttpEnsoBridgeStatusProvider({
      fetcher: vi.fn(async () => Response.json({ error: 'callback reverted', status: 'failed' })),
      waiter: async () => undefined
    })

    await expect(provider.waitForCompletion(request)).rejects.toThrow('callback reverted')
  })
})
