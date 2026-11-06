// @vitest-environment jsdom
import { DemoContext } from '@erc4626/lib/demoContext'
import { DEMO_FACTORY } from '@erc4626/lib/demoHolding'
import { useVaultPickerBalances, walletTokenKey } from '@erc4626/lib/useVaultPickerBalances'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ multicall: vi.fn(), readContract: vi.fn() }))
vi.mock('@wagmi/core', () => ({ getPublicClient: () => rpc }))
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x3333333333333333333333333333333333333333' }),
  useConfig: () => ({})
}))
const vault = '0x1111111111111111111111111111111111111111' as const
const asset = '0x2222222222222222222222222222222222222222' as const
const choices = [{ address: vault, chainId: 1, assetAddress: asset, name: 'Vault', symbol: 'SHARE' }]
const wrapper = (demo: boolean) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <DemoContext.Provider value={demo}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DemoContext.Provider>
  )
}
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
it('preserves a known zero separately from an unreadable balance', async () => {
  rpc.multicall.mockResolvedValue([
    { status: 'success', result: 0n },
    { status: 'failure', error: new Error('RPC unavailable') }
  ])
  const { result } = renderHook(() => useVaultPickerBalances(choices), { wrapper: wrapper(false) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.balances[walletTokenKey(1, vault)]).toBe(0n)
  expect(result.current.data?.balances[walletTokenKey(1, asset)]).toBeUndefined()
  expect(result.current.data?.unreadable).toBe(1)
  expect(rpc.multicall.mock.calls[0][0].contracts).toHaveLength(2)
})
it('uses the isolated demo transport for sample LP balances without multicall or unrelated token reads', async () => {
  rpc.readContract.mockImplementation(async ({ address }) =>
    address.toLowerCase() === DEMO_FACTORY.asset.toLowerCase() ? 25n : 10n
  )
  const { result } = renderHook(
    () =>
      useVaultPickerBalances([
        ...choices,
        { address: DEMO_FACTORY.address, chainId: 1, assetAddress: DEMO_FACTORY.asset, name: 'Factory', symbol: 'LP' }
      ]),
    { wrapper: wrapper(true) }
  )
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.balances[walletTokenKey(1, DEMO_FACTORY.asset)]).toBe(25n)
  expect(result.current.data?.balances[walletTokenKey(1, DEMO_FACTORY.address)]).toBe(10n)
  expect(rpc.readContract).toHaveBeenCalledTimes(2)
  expect(rpc.multicall).not.toHaveBeenCalled()
})
