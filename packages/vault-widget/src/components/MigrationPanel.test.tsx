// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultWidgetConfig, VaultWidgetToken } from '../types'
import { MigrationPanel } from './MigrationPanel'

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  signTypedDataAsync: vi.fn(),
  submit: vi.fn(),
  usePublicClient: vi.fn()
}))

vi.mock('wagmi', () => ({
  usePublicClient: mocks.usePublicClient,
  useSignTypedData: () => ({
    isPending: false,
    signTypedDataAsync: mocks.signTypedDataAsync
  })
}))

vi.mock('../headless/useVaultWidgetActionController', () => ({
  useVaultWidgetActionController: mocks.action
}))

const account = '0x1111111111111111111111111111111111111111' as const
const nextAccount = '0x2222222222222222222222222222222222222222' as const
const positionToken: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 18,
  symbol: 'yvOLD'
}
const targetToken: VaultWidgetToken = {
  address: '0x4444444444444444444444444444444444444444',
  chainId: 1,
  decimals: 18,
  symbol: 'yvNEW'
}
const config: VaultWidgetConfig = {
  adapters: [],
  chainId: 1,
  depositTokens: [],
  id: 'migration-test',
  migration: {
    migratorAddress: '0x1112dbCF805682e828606f74AB717abf4b4FD8DE',
    sourceVersion: '3.0.4',
    targetToken,
    targetVault: targetToken.address
  },
  modes: ['migrate'],
  name: 'Migration test',
  positionToken,
  vaultAddress: positionToken.address,
  withdrawTokens: []
}
const signature = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b` as const
const permitTypehash = '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'

function createPublicClient(nonces: readonly bigint[]): PublicClient {
  const nonceResults = [...nonces]
  return {
    getBlock: vi.fn().mockResolvedValueOnce({ timestamp: 1_000n }).mockResolvedValueOnce({ timestamp: 1_001n }),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'DOMAIN_SEPARATOR') return `0x${'11'.repeat(32)}`
      if (functionName === 'PERMIT_TYPEHASH') return permitTypehash
      if (functionName === 'nonces') return nonceResults.shift() ?? nonces.at(-1) ?? 0n
      if (functionName === 'version' || functionName === 'apiVersion') return '3.0.4'
      throw new Error(`Unexpected contract read: ${functionName}`)
    })
  } as unknown as PublicClient
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  const state = {} as { resolve: (value: T) => void }
  const promise = new Promise<T>((resolve) => {
    state.resolve = resolve
  })
  return {
    promise,
    resolve: (value) => state.resolve(value)
  }
}

function renderPanel(panelAccount: typeof account | typeof nextAccount): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MigrationPanel
        account={panelAccount}
        config={config}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        positionBalance={12n}
      />
    </QueryClientProvider>
  )
}

async function getPermitButton(): Promise<HTMLButtonElement> {
  return (await screen.findByRole('button', { name: 'Sign & Migrate' })) as HTMLButtonElement
}

describe('MigrationPanel permit lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.action.mockReturnValue({
      allowance: 0n,
      canSubmit: true,
      execution: { status: 'idle' },
      isLoading: false,
      plan: undefined,
      submit: mocks.submit,
      walletType: 'eoa'
    })
    mocks.signTypedDataAsync.mockResolvedValue(signature)
  })

  it('does not submit a signature when its nonce changed during the wallet prompt', async () => {
    mocks.usePublicClient.mockReturnValue(createPublicClient([7n, 8n]))
    renderPanel(account)

    fireEvent.click(await getPermitButton())

    expect((await screen.findByRole('alert')).textContent).toContain('Migration permit nonce changed before submission')
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('does not submit a permit signed for an account that disconnected during the wallet prompt', async () => {
    const publicClient = createPublicClient([7n, 7n])
    mocks.usePublicClient.mockReturnValue(publicClient)
    const pendingSignature = createDeferred<typeof signature>()
    mocks.signTypedDataAsync.mockReturnValue(pendingSignature.promise)
    const view = renderPanel(account)

    fireEvent.click(await getPermitButton())
    view.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MigrationPanel
          account={nextAccount}
          config={config}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          positionBalance={12n}
        />
      </QueryClientProvider>
    )
    pendingSignature.resolve(signature)

    await waitFor(() => expect(publicClient.getBlock).toHaveBeenCalledTimes(2))
    expect(mocks.submit).not.toHaveBeenCalled()
  })
})
