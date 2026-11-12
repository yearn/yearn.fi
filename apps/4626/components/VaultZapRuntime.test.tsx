// @vitest-environment jsdom
import { VaultZapRuntime } from '@erc4626/components/VaultZapRuntime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useVaultWidgetRuntime, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { afterEach, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ readContract: vi.fn(), getBalance: vi.fn(), probe: vi.fn() }))
vi.mock('@wagmi/core', () => ({ getPublicClient: () => rpc }))
vi.mock('wagmi', () => ({ useConfig: () => ({}) }))
vi.mock('@erc4626/lib/useVaultDiscovery', () => ({ useYearnVaultMetadata: () => ({ data: [], isSuccess: true }) }))
vi.mock('@yearn/vault-widget/internal/hooks/useVaultWidgetSpotPrices', () => ({
  useVaultWidgetSpotPrices: () => ({ getUsdPrice: () => 2 })
}))
const owner = '0x3333333333333333333333333333333333333333'
const asset = '0x2222222222222222222222222222222222222222'
function Probe() {
  const runtime = useVaultWidgetRuntime()
  rpc.probe(runtime)
  return (
    <button type="button" onClick={runtime.catalog.enableTokenList}>
      Load assets
    </button>
  )
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
it.each([false, true])(
  'loads wallet assets on demand and enables deposit networks only with balances (%s)',
  async (hasBaseBalance) => {
    const token = { chainId: 1, address: asset, decimals: 6, name: 'Coin', symbol: 'COIN' }
    const baseUsdc = {
      chainId: 8453,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      name: 'USD Coin',
      symbol: 'USDC'
    } as const
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(
          url.includes('/enso/balances')
            ? [
                { token: asset, chainId: 1, amount: '10000000' },
                ...(hasBaseBalance ? [{ token: asset, chainId: 8453, amount: '10000000' }] : [])
              ]
            : { tokens: [token, baseUsdc] }
        )
      )
    )
    rpc.getBalance.mockResolvedValue(0n)
    rpc.readContract.mockImplementation(
      async ({ functionName }) =>
        ({ balanceOf: 10_000_000n, decimals: 6, name: 'Coin', symbol: 'COIN' })[functionName as 'balanceOf']
    )
    const refresh = vi.fn(async () => undefined)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <VaultWidgetRuntimeProvider value={{ wallet: { address: owner, refresh } }}>
          <VaultZapRuntime chainId={1}>
            <Probe />
          </VaultZapRuntime>
        </VaultWidgetRuntimeProvider>
      </QueryClientProvider>
    )
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Load assets' }))
    await waitFor(() =>
      expect(rpc.probe.mock.lastCall?.[0].wallet.getToken({ address: asset, chainId: 1 })?.balanceRaw).toBe(10_000_000n)
    )
    const runtime = rpc.probe.mock.lastCall![0] as ReturnType<typeof useVaultWidgetRuntime>
    expect(runtime.routing.isEnsoEnabled({ chainId: 1 })).toBe(true)
    expect(runtime.routing.isEnsoEnabled({ chainId: 8453 })).toBe(false)
    expect(runtime.routing.tokenSelectionChainIds).toEqual(hasBaseBalance ? [1, 8453] : [1])
    expect(runtime.routing.withdrawalTokenSelectionChainIds).toEqual(
      expect.arrayContaining([1, 10, 137, 42161, 8453, 4663])
    )
    await waitFor(() =>
      expect(rpc.probe.mock.lastCall?.[0].wallet.getToken(baseUsdc)).toMatchObject({ ...baseUsdc, balanceRaw: 0n })
    )
    expect(runtime.wallet.getToken({ ...baseUsdc, chainId: 1 })).toBeUndefined()
    expect(runtime.routing.ensoRouteEndpoint).toBe('https://yearn.fi/api/enso/route')
    expect(runtime.wallet.getToken({ address: asset, chainId: 1 })?.usdValue).toBe(20)
    rpc.readContract.mockImplementation(
      async ({ functionName }) =>
        ({ balanceOf: 9_000_000n, decimals: 6, name: 'Coin', symbol: 'COIN' })[functionName as 'balanceOf']
    )
    await runtime.wallet.refresh()
    await waitFor(() =>
      expect(rpc.probe.mock.lastCall?.[0].wallet.getToken({ address: asset, chainId: 1 })?.balanceRaw).toBe(9_000_000n)
    )
    expect(refresh).toHaveBeenCalledOnce()
  }
)
