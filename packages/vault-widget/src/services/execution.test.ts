import { describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import { createSafeAwareExecutionService } from './execution'

const account = '0x1111111111111111111111111111111111111111'
const config = {} as Config
const request = {
  chainId: 1,
  data: '0x1234',
  to: '0x2222222222222222222222222222222222222222'
} as const
const step = {
  chainId: 1,
  id: 'safe-proposal',
  kind: 'safe-proposal' as const,
  label: 'Propose transaction',
  requests: [request]
}

describe('createSafeAwareExecutionService', () => {
  it('detects Safe wallets and delegates proposal lifecycle operations', async () => {
    const propose = vi.fn(async () => '0x1234' as const)
    const waitForExecution = vi.fn(async () => '0xabcd' as const)
    const service = createSafeAwareExecutionService({
      isSafe: async () => true,
      propose,
      waitForExecution
    })

    await expect(service.getWalletType?.({ account, config })).resolves.toBe('safe')
    await expect(
      service.proposeSafeBatch?.({
        account,
        chainId: 1,
        config,
        requests: [request],
        step
      })
    ).resolves.toBe('0x1234')
    await expect(service.waitForSafeExecution?.(config, 1, '0x1234')).resolves.toBe('0xabcd')
    expect(propose).toHaveBeenCalledOnce()
    expect(waitForExecution).toHaveBeenCalledOnce()
  })
})
