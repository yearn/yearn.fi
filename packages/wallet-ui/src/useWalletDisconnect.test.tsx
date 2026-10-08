import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useWalletDisconnect } from '@yearn/wallet-ui/useWalletDisconnect'
import type { PropsWithChildren } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { connect, disconnect, getAccount, getConnections } from 'wagmi/actions'
import { mainnet } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'

const account = '0x1111111111111111111111111111111111111111'
function setup() {
  const config = createConfig({
    chains: [mainnet],
    // Two connector records can refer to the same wallet address.
    connectors: [mock({ accounts: [account] }), mock({ accounts: [account] }), mock({ accounts: [account] })],
    multiInjectedProviderDiscovery: false,
    storage: null,
    transports: { [mainnet.id]: http() }
  })
  const queryClient = new QueryClient()
  const wrapper = ({ children }: PropsWithChildren) => (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
  return { config, wrapper }
}

afterEach(cleanup)

it('reproduces the old two-click behavior when disconnect only removes the current connection', async () => {
  const { config } = setup()
  await connect(config, { connector: config.connectors[0] })
  await connect(config, { connector: config.connectors[1] })
  await disconnect(config)
  expect(getAccount(config).address).toBe(account)
  expect(getAccount(config).isConnected).toBe(true)
  await disconnect(config)
  expect(getAccount(config).isDisconnected).toBe(true)
})

it('disconnects both records with one UI action and allows a fresh connection afterward', async () => {
  const { config, wrapper } = setup()
  await connect(config, { connector: config.connectors[0] })
  await connect(config, { connector: config.connectors[1] })
  const { result } = renderHook(useWalletDisconnect, { wrapper })
  act(() => result.current.disconnect())
  await waitFor(() => expect(getAccount(config).isDisconnected).toBe(true))
  expect(getConnections(config)).toEqual([])
  await act(async () => {
    await connect(config, { connector: config.connectors[1] })
  })
  expect(getAccount(config).isConnected).toBe(true)
})

it('clears a connected status without a connection record and permits reconnecting', async () => {
  const { config, wrapper } = setup()
  const connector = config.connectors[0]
  await connect(config, { connector })
  // Reproduce hydration clearing the records after an early provider connect event.
  config.setState((state) => ({ ...state, connections: new Map() }))
  expect(getAccount(config)).toMatchObject({ isConnected: true, address: undefined })
  const { result } = renderHook(useWalletDisconnect, { wrapper })
  await act(async () => {
    await result.current.disconnectAsync()
  })
  expect(getAccount(config).isDisconnected).toBe(true)
  expect(config.state.current).toBeNull()
  await act(async () => {
    await connect(config, { connector })
  })
  expect(getAccount(config).address).toBe(account)
})

it('keeps disconnect pending until both connector requests finish', async () => {
  const { config, wrapper } = setup()
  const [first, second] = config.connectors
  await connect(config, { connector: first })
  await connect(config, { connector: second })
  const pendingFirst = Promise.withResolvers<void>()
  const pendingSecond = Promise.withResolvers<void>()
  vi.spyOn(first, 'disconnect').mockReturnValue(pendingFirst.promise)
  vi.spyOn(second, 'disconnect').mockReturnValue(pendingSecond.promise)
  const { result } = renderHook(useWalletDisconnect, { wrapper })
  act(() => result.current.disconnect())
  await waitFor(() => expect(result.current.isPending).toBe(true))
  expect(second.disconnect).not.toHaveBeenCalled()
  await act(async () => {
    pendingFirst.resolve()
  })
  await waitFor(() => expect(second.disconnect).toHaveBeenCalledOnce())
  expect(result.current.isPending).toBe(true)
  await act(async () => {
    pendingSecond.resolve()
  })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(getConnections(config)).toEqual([])
})

it('surfaces connector failures and permits a retry', async () => {
  const { config, wrapper } = setup()
  const [connector] = config.connectors
  await connect(config, { connector })
  const failure = new Error('Wallet refused to disconnect')
  vi.spyOn(connector, 'disconnect').mockRejectedValueOnce(failure)
  const { result } = renderHook(useWalletDisconnect, { wrapper })
  await act(async () => {
    await expect(result.current.disconnectAsync()).rejects.toBe(failure)
  })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(getAccount(config).isConnected).toBe(true)
  await act(async () => {
    await result.current.disconnectAsync()
  })
  expect(getAccount(config).isDisconnected).toBe(true)
})
