import { describe, expect, it, vi } from 'vitest'
import { type EnsoSimulationError, simulateEnsoOrder, type TEnsoTransaction } from './useEnsoOrder'

const TRANSACTION: TEnsoTransaction = {
  to: '0x0000000000000000000000000000000000000001',
  from: '0x0000000000000000000000000000000000000002',
  data: '0x1234',
  value: '7',
  chainId: 1
}

describe('simulateEnsoOrder', () => {
  it('simulates the exact raw Enso transaction before wallet submission', async () => {
    const call = vi.fn(async () => ({ data: '0x' as const }))

    await simulateEnsoOrder({ call } as never, TRANSACTION)

    expect(call).toHaveBeenCalledWith({
      account: TRANSACTION.from,
      to: TRANSACTION.to,
      data: TRANSACTION.data,
      value: 7n
    })
  })

  it('turns a simulation revert into an actionable blocked-execution error', async () => {
    const cause = new Error('execution reverted')
    const call = vi.fn(async () => {
      throw cause
    })

    await expect(simulateEnsoOrder({ call } as never, TRANSACTION)).rejects.toMatchObject({
      name: 'EnsoSimulationError',
      message: 'This route can no longer execute. The quote is refreshing; please try again.',
      cause
    } satisfies Partial<EnsoSimulationError>)
  })
})
