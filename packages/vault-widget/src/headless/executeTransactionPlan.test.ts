import { describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import type { VaultWidgetTransactionPlan } from '../types'
import { executeVaultWidgetPlan } from './executeTransactionPlan'

const account = '0x1111111111111111111111111111111111111111'
const hash = `0x${'22'.repeat(32)}` as const
const request = {
  chainId: 1,
  data: '0x1234' as const,
  to: '0x3333333333333333333333333333333333333333' as const
}
const plan: VaultWidgetTransactionPlan = {
  id: 'rewards:test',
  mode: 'rewards',
  quote: {
    adapterId: 'staking-rewards',
    amountIn: 0n,
    expectedOut: 1n,
    minExpectedOut: 1n,
    positionAmount: 0n,
    transaction: request
  },
  steps: [
    { id: 'rewards', kind: 'execute', label: 'Claim rewards', chainId: 1, request },
    { id: 'refresh', kind: 'refresh', label: 'Refresh balances' }
  ],
  walletType: 'eoa'
}

describe('executeVaultWidgetPlan', () => {
  it('runs execution, receipt, and refresh steps through one state machine', async () => {
    const execute = vi.fn().mockResolvedValue(hash)
    const waitForReceipt = vi.fn().mockResolvedValue(undefined)
    const onExecution = vi.fn()
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        execution: { execute, waitForReceipt },
        onExecution,
        onRefresh,
        plan
      })
    ).resolves.toEqual({ hash })

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ account, request }))
    expect(waitForReceipt).toHaveBeenCalledWith(expect.anything(), 1, hash)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onExecution).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', hash }))
  })
})
