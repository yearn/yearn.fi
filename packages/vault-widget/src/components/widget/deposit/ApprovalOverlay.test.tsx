// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApprovalOverlay } from '@yearn/vault-widget/internal/components/widget/deposit/ApprovalOverlay'
import { createTransactionLifecycle } from '@yearn/vault-widget/lifecycle'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { decodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-rewards', () => ({ useReward: () => ({ reward: () => undefined }) }))
const owner = '0x1111111111111111111111111111111111111111'
const token = '0x2222222222222222222222222222222222222222'
const spender = '0x3333333333333333333333333333333333333333'
const stops: (() => void)[] = []
afterEach(() => {
  cleanup()
  stops.splice(0).forEach((stop) => {
    stop()
  })
})
function fixture(safe = false, warning?: string) {
  const execute = vi.fn().mockResolvedValue(`0x${'a'.repeat(64)}`)
  const proposeSafeBatch = vi.fn().mockResolvedValue('0x1234')
  const service = createTransactionLifecycle({
    execution: () => ({
      execute,
      proposeSafeBatch,
      observeSafeExecution: async () => ({ status: 'pending' }),
      waitForReceipt: () => new Promise(() => undefined),
      switchChain: vi.fn()
    }),
    wallet: () => ({ address: owner, chainId: 1 }),
    executionChainId: () => 1
  })
  stops.push(service.connect())
  render(
    <VaultWidgetRuntimeProvider
      value={{ lifecycle: service, wallet: { address: owner, chainId: 1 }, safe: { isSafe: safe } }}
    >
      <ApprovalOverlay
        isOpen
        onClose={vi.fn()}
        tokenSymbol="USDC"
        tokenAddress={token}
        tokenDecimals={6}
        spenderAddress={spender}
        spenderName="Yearn"
        chainId={1}
        currentAllowance="10"
        approvalWarning={warning}
      />
    </VaultWidgetRuntimeProvider>
  )
  return { execute, proposeSafeBatch, service }
}
describe('approval management lifecycle', () => {
  it.each([false, true])('registers the exact revoke with the shared service (Safe: %s)', async (safe) => {
    const f = fixture(safe)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await waitFor(() => expect(f.service.getSnapshot().records).toHaveLength(1))
    const record = f.service.getSnapshot().records[0]
    expect(record.request.to).toBe(token)
    expect(decodeFunctionData({ abi: erc20Abi, data: record.request.data }).args).toEqual([spender, 0n])
    expect(safe ? f.proposeSafeBatch : f.execute).toHaveBeenCalledTimes(1)
    if (safe) await screen.findByText('Awaiting Safe execution')
  })
  it('uses the reviewed spender and unlimited amount', async () => {
    const f = fixture()
    fireEvent.click(screen.getByRole('button', { name: 'Set unlimited' }))
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    expect(decodeFunctionData({ abi: erc20Abi, data: f.execute.mock.calls[0][0].request.data }).args).toEqual([
      spender,
      maxUint256
    ])
  })
  it('keeps approval warnings blocking both wallet actions', () => {
    const f = fixture(false, 'Spender unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set unlimited' }))
    expect(f.execute).not.toHaveBeenCalled()
  })
})
