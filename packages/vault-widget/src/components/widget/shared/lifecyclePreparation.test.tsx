// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LifecycleTransactionOverlay } from '@yearn/vault-widget/internal/components/widget/shared/LifecycleTransactionOverlay'
import type { TransactionStep } from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import { createTransactionLifecycle } from '@yearn/vault-widget/lifecycle'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { StrictMode, useState } from 'react'
import type { TransactionReceipt } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-rewards', () => ({ useReward: () => ({ reward: () => undefined }) }))
const owner = '0x1111111111111111111111111111111111111111'
const hash = `0x${'a'.repeat(64)}` as const
const receipt = { transactionHash: hash, status: 'success', blockNumber: 1n, blockHash: hash } as TransactionReceipt
const cleanups: (() => void)[] = []
afterEach(() => {
  cleanup()
  cleanups.splice(0).forEach((stop) => {
    stop()
  })
})
const ready = (data: `0x${string}`) => ({
  isSuccess: true,
  isError: false,
  isFetching: false,
  isLoading: false,
  status: 'success' as const,
  data: { request: { chainId: 1, to: owner, data } }
})
const deferred = <T,>() => {
  const state: { resolve?: (value: T) => void } = {}
  return {
    promise: new Promise<T>((resolve) => {
      state.resolve = resolve
    }),
    resolve: (value: T) => state.resolve!(value)
  }
}

function fixture(permit = false) {
  const confirmation = deferred<{ receipt: TransactionReceipt }>()
  const signed = deferred<`0x${string}`>()
  const execute = vi.fn().mockResolvedValue(hash)
  const signPermit = vi.fn().mockReturnValue(signed.promise)
  const service = createTransactionLifecycle({
    execution: () => ({ execute, signPermit, waitForReceipt: () => confirmation.promise, switchChain: vi.fn() }),
    wallet: () => ({ address: owner, chainId: 1 }),
    executionChainId: () => 1
  })
  cleanups.push(service.connect())
  const completed = vi.fn()
  const preparation = vi.fn()
  function App() {
    const [open, setOpen] = useState(true)
    const [advance, setAdvance] = useState(false)
    const [signature, setSignature] = useState<`0x${string}`>()
    const firstId = permit ? 'permit' : 'unstake'
    const step: TransactionStep = advance
      ? {
          confirmMessage: 'Confirm',
          successMessage: 'Done',
          id: 'withdraw',
          label: 'Withdraw',
          prepare: ready(signature ?? '0x5678'),
          successTitle: 'Withdraw complete'
        }
      : {
          confirmMessage: 'Confirm',
          successMessage: 'Done',
          successTitle: 'Done',
          id: firstId,
          label: firstId,
          prepare: ready('0x1234'),
          ...(permit
            ? {
                isPermit: true,
                permitData: {
                  getPermitData: async () => ({ primaryType: 'Permit', domain: { chainId: 1 }, types: {}, message: {} })
                },
                onPermitSigned: setSignature
              }
            : {})
        }
    return (
      <VaultWidgetRuntimeProvider value={{ lifecycle: service, wallet: { address: owner, chainId: 1 } }}>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        {open ? (
          <LifecycleTransactionOverlay
            isOpen
            step={step}
            lifecycleRecipe={{
              id: 'reviewed-withdraw',
              chainId: 1,
              steps: [...(advance ? [] : [{ id: firstId, label: firstId }]), { id: 'withdraw', label: 'Withdraw' }]
            }}
            onClose={() => setOpen(false)}
            onAllComplete={completed}
            onStepSuccess={(id, receipt) => {
              if (id !== firstId) return
              preparation(id, receipt)
              setAdvance(true)
            }}
          />
        ) : null}
      </VaultWidgetRuntimeProvider>
    )
  }
  render(
    <StrictMode>
      <App />
    </StrictMode>
  )
  return { service, execute, signPermit, confirmation, signed, completed, preparation }
}

describe('deferred route preparation bridge', () => {
  it('advances from a confirmed receipt once and uses the newly prepared request', async () => {
    const f = fixture()
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    expect(f.preparation).not.toHaveBeenCalled()
    await act(async () => f.confirmation.resolve({ receipt }))
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(2))
    expect(f.preparation).toHaveBeenCalledExactlyOnceWith('unstake', receipt)
    expect(f.execute.mock.calls[1][0].request.data).toBe('0x5678')
    await screen.findByText('Withdraw complete')
    expect(f.completed).toHaveBeenCalledTimes(1)
  })
  it.each([false, true])(
    'reattaches after a late result without requesting another wallet action until Continue (permit: %s)',
    async (permit) => {
      const f = fixture(permit)
      await waitFor(() => expect(permit ? f.signPermit : f.execute).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByRole('button', { name: 'Close transaction progress' }))
      await act(async () => {
        if (permit) f.signed.resolve('0xabcd')
        else f.confirmation.resolve({ receipt })
      })
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      await screen.findByRole('button', { name: 'Continue' })
      expect(f.execute).toHaveBeenCalledTimes(permit ? 0 : 1)
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(permit ? 1 : 2))
      expect(f.execute.mock.calls.at(-1)![0].request.data).toBe(permit ? '0xabcd' : '0x5678')
      expect(f.preparation).toHaveBeenCalledTimes(1)
    }
  )
})
