import { RainbowKitProvider, useConnectModal } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useWalletDisconnect } from '@yearn/wallet-ui/useWalletDisconnect'
import { cancelWalletReconnect, WalletProvider } from '@yearn/wallet-ui/WalletProvider'
import { type ReactNode, StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { type Config, type CreateConnectorFn, createConfig, createStorage, http, useAccount } from 'wagmi'
import { connect, disconnect, getAccount } from 'wagmi/actions'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

const account = '0x1111111111111111111111111111111111111111'
type TInjectedProvider = NonNullable<Awaited<ReturnType<ReturnType<ReturnType<typeof injected>>['getProvider']>>>
const createBrowserWalletConfig = (
  initiallyAuthorized = false,
  { connectors = [], announceOnRequest = true }: { connectors?: CreateConnectorFn[]; announceOnRequest?: boolean } = {}
) => {
  const authorization = { connected: initiallyAuthorized }
  const provider = {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x1'
      if (method === 'eth_requestAccounts') authorization.connected = true
      return authorization.connected ? [account] : []
    }),
    on: vi.fn(),
    removeListener: vi.fn()
  }
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: {
            uuid: crypto.randomUUID(),
            name: 'WalletChan',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
            rdns: 'com.walletchan'
          },
          provider
        }
      })
    )
  if (announceOnRequest) window.addEventListener('eip6963:requestProvider', announce)
  const storageKey = crypto.randomUUID()
  if (initiallyAuthorized)
    window.localStorage.setItem(`${storageKey}.recentConnectorId`, JSON.stringify('com.walletchan'))
  const config = createConfig({
    chains: [mainnet],
    connectors,
    storage: createStorage({ storage: window.localStorage, key: storageKey }),
    ssr: true,
    transports: { [mainnet.id]: http() }
  })
  window.removeEventListener('eip6963:requestProvider', announce)
  return { announce, config, provider }
}

function WalletControls() {
  const { openConnectModal } = useConnectModal()
  const { disconnect: disconnectWallet } = useWalletDisconnect()
  const { status } = useAccount()
  return (
    <>
      <button type="button" onClick={openConnectModal}>
        More wallets
      </button>
      <span data-testid="status">{status}</span>
      <button type="button" onClick={disconnectWallet}>
        Disconnect
      </button>
    </>
  )
}

function Providers({
  config,
  children,
  reconnectOnMount = true
}: {
  config: Config
  children?: ReactNode
  reconnectOnMount?: boolean
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <WalletProvider config={config} reconnectOnMount={reconnectOnMount}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>
          <WalletControls />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WalletProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('mounts, unmounts and remounts one detected wallet without duplicating its RainbowKit menu entry', async () => {
  const { config } = createBrowserWalletConfig()
  const first = render(<Providers config={config} />)
  await waitFor(() => expect(config.connectors.filter(({ id }) => id === 'com.walletchan')).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: 'More wallets' }))
  expect(await screen.findAllByRole('button', { name: /WalletChan/ })).toHaveLength(1)
  first.unmount()

  render(<Providers config={config} />)
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('disconnected'))
  expect(config.connectors.filter(({ id }) => id === 'com.walletchan')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'More wallets' }))
  expect(await screen.findAllByRole('button', { name: /WalletChan/ })).toHaveLength(1)
})

it('hydrates once in StrictMode and retains the established connection on a later remount', async () => {
  const { config } = createBrowserWalletConfig(true)
  const first = render(
    <StrictMode>
      <Providers config={config} />
    </StrictMode>
  )
  await waitFor(() => expect(config.connectors.filter(({ id }) => id === 'com.walletchan')).toHaveLength(1))
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'))
  first.unmount()
  render(
    <StrictMode>
      <Providers config={config} />
    </StrictMode>
  )
  expect(config.connectors.filter(({ id }) => id === 'com.walletchan')).toHaveLength(1)
  expect(getAccount(config).address).toBe(account)
  expect(screen.getByTestId('status').textContent).toBe('connected')
})

it('preserves reconnectOnMount=false without requesting browser-wallet accounts during hydration', async () => {
  const { config, provider } = createBrowserWalletConfig(true)
  const first = render(<Providers config={config} reconnectOnMount={false} />)
  await waitFor(() => expect(config.connectors).toHaveLength(1))
  expect(getAccount(config).status).toBe('disconnected')
  expect(provider.request).not.toHaveBeenCalled()
  first.unmount()
  render(<Providers config={config} reconnectOnMount={false} />)
  expect(config.connectors).toHaveLength(1)
  expect(provider.request).not.toHaveBeenCalled()
})

it('restores the last wallet without waiting for an unrelated extension that never answers', async () => {
  const blocked = { resolve: (_value: string[]) => {} }
  const response = new Promise<string[]>((resolve) => {
    blocked.resolve = resolve
  })
  const slowProvider = { request: vi.fn(() => response), on: vi.fn(), removeListener: vi.fn() }
  const { config } = createBrowserWalletConfig(true, {
    connectors: [
      injected({
        target: { id: 'slow-extension', name: 'Slow extension', provider: slowProvider as TInjectedProvider }
      })
    ]
  })
  try {
    render(<Providers config={config} />)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'))
    expect(getAccount(config).connector?.id).toBe('com.walletchan')
    expect(slowProvider.request).not.toHaveBeenCalled()
  } finally {
    await act(async () => blocked.resolve([]))
  }
})

it('restores a saved EIP-6963 wallet announced after hydration', async () => {
  const { config, announce } = createBrowserWalletConfig(true, { announceOnRequest: false })
  render(<Providers config={config} />)
  await act(async () => {})
  expect(getAccount(config).status).toBe('disconnected')
  act(announce)
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'))
  expect(getAccount(config).connector?.id).toBe('com.walletchan')
})

it.each([true, false])('handles an early wallet connection with reconnectOnMount=%s', async (reconnectOnMount) => {
  const provider = {
    request: vi.fn(async ({ method }: { method: string }) => (method === 'eth_chainId' ? '0x1' : [account])),
    on: vi.fn(),
    removeListener: vi.fn()
  }
  const { config } = createBrowserWalletConfig(false, {
    announceOnRequest: false,
    connectors: [injected({ target: { id: 'trust', name: 'Trust Wallet', provider: provider as TInjectedProvider } })]
  })
  await config.storage?.setItem('recentConnectorId', 'trust')
  await config.connectors[0].onConnect?.({ chainId: '0x1' })
  expect(getAccount(config).address).toBe(account)

  render(<Providers config={config} reconnectOnMount={reconnectOnMount} />)
  await act(async () => {})
  await waitFor(() => expect(getAccount(config).address).toBe(reconnectOnMount ? account : undefined))
  expect(getAccount(config).status).toBe(reconnectOnMount ? 'connected' : 'disconnected')
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  await waitFor(() => expect(getAccount(config).isDisconnected).toBe(true))
})

it('does not restore a late saved wallet after the user selects another wallet', async () => {
  const chosenProvider = {
    request: vi.fn(async ({ method }: { method: string }) => (method === 'eth_chainId' ? '0x1' : [account])),
    on: vi.fn(),
    removeListener: vi.fn()
  }
  const { config, announce, provider } = createBrowserWalletConfig(true, {
    announceOnRequest: false,
    connectors: [
      injected({
        target: { id: 'chosen-wallet', name: 'Chosen wallet', provider: chosenProvider as TInjectedProvider }
      })
    ]
  })
  render(<Providers config={config} />)
  await act(async () => {})
  await act(async () => {
    await connect(config, { connector: config.connectors[0] })
  })
  await act(async () => {
    await disconnect(config)
  })
  act(announce)
  await act(async () => {})
  expect(getAccount(config).status).toBe('disconnected')
  expect(provider.request).not.toHaveBeenCalled()
})

it.each(['authorization', 'connection'])(
  'does not let slow %s during automatic reconnect replace a user selection',
  async (phase) => {
    const release = { resolve: (_value: string[]) => {} }
    const response = new Promise<string[]>((resolve) => {
      release.resolve = resolve
    })
    const chosenProvider = {
      request: vi.fn(async ({ method }: { method: string }) => (method === 'eth_chainId' ? '0x1' : [account])),
      on: vi.fn(),
      removeListener: vi.fn()
    }
    const { config, provider } = createBrowserWalletConfig(true, {
      connectors: [
        injected({
          target: { id: 'chosen-wallet', name: 'Chosen wallet', provider: chosenProvider as TInjectedProvider }
        })
      ]
    })
    provider.request.mockImplementation(async ({ method }) => {
      if (method === 'eth_chainId') return '0x1'
      const accountRequests = provider.request.mock.calls.filter(
        ([request]) => request.method === 'eth_accounts'
      ).length
      if (phase === 'connection' && accountRequests === 1) return [account]
      return response
    })
    try {
      render(<Providers config={config} />)
      await waitFor(() =>
        expect(provider.request.mock.calls.filter(([request]) => request.method === 'eth_accounts')).toHaveLength(
          phase === 'connection' ? 2 : 1
        )
      )
      const chosen = config.connectors.find(({ id }) => id === 'chosen-wallet')!
      cancelWalletReconnect(config, chosen)
      await act(async () => {
        await connect(config, { connector: chosen })
      })
      await act(async () => {
        release.resolve([account])
      })
      await waitFor(() => expect(config.state.connections.size).toBe(1))
      expect(getAccount(config).connector?.id).toBe('chosen-wallet')
      await act(async () => {
        await disconnect(config)
      })
      expect(getAccount(config).status).toBe('disconnected')
    } finally {
      await act(async () => {
        release.resolve([account])
      })
    }
  }
)

it('keeps an explicitly disconnected wallet disconnected after remount', async () => {
  const { config, provider } = createBrowserWalletConfig(true)
  const first = render(<Providers config={config} />)
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'))
  await act(async () => {
    await disconnect(config)
  })
  first.unmount()
  provider.request.mockClear()
  render(<Providers config={config} />)
  await act(async () => {})
  expect(getAccount(config).status).toBe('disconnected')
  expect(provider.request).not.toHaveBeenCalled()
})

it('cancels a pending automatic reconnect when Disconnect is requested', async () => {
  const { config, provider } = createBrowserWalletConfig(true)
  const pending = Promise.withResolvers<string[]>()
  provider.request.mockImplementation(async ({ method }) => (method === 'eth_chainId' ? '0x1' : pending.promise))
  render(<Providers config={config} />)
  await waitFor(() => expect(provider.request).toHaveBeenCalledWith({ method: 'eth_accounts' }))
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  await act(async () => {
    pending.resolve([account])
  })
  await waitFor(() => expect(getAccount(config).isDisconnected).toBe(true))
  expect(config.state.connections.size).toBe(0)
})
