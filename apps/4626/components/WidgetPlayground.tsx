'use client'

import { VaultApp } from '@erc4626/components/VaultApp'
import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { DemoContext, DemoWalletContext } from '@erc4626/lib/demoContext'
import { createDemoWallet, DEMO_ACCOUNT } from '@erc4626/lib/demoWallet'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { connect, createConnector, mock } from '@wagmi/core'
import { DEFAULT_VAULT_WIDGET_RUNTIME, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { useEffect, useState } from 'react'
import { custom, type Transport } from 'viem'
import { createConfig, useAccount, WagmiProvider } from 'wagmi'

function createSession() {
  const wallet = createDemoWallet()
  const connector = createConnector((config) => ({
    ...mock({ accounts: [DEMO_ACCOUNT] })(config),
    id: 'erc4626-demo',
    name: 'Demo wallet',
    getChainId: async () => wallet.controls.chainId,
    getProvider: async () => ({
      request: ({ method, params }: { method: string; params?: readonly unknown[] }) =>
        wallet.request(wallet.controls.chainId, method, params),
      on: () => undefined,
      removeListener: () => undefined
    }),
    switchChain: async ({ chainId }) => {
      const chain = SUPPORTED_CHAINS.find((item) => item.id === chainId)
      if (!chain) throw new Error('Unsupported demo network')
      wallet.controls.chainId = chainId
      config.emitter.emit('change', { chainId })
      return chain
    }
  }))
  const config = createConfig({
    chains: SUPPORTED_CHAINS,
    connectors: [connector],
    multiInjectedProviderDiscovery: false,
    storage: null,
    ssr: false,
    batch: { multicall: false },
    transports: Object.fromEntries(
      SUPPORTED_CHAINS.map((chain) => [
        chain.id,
        custom({
          request: ({ method, params }) => wallet.request(chain.id, method, params as readonly unknown[] | undefined)
        })
      ])
    ) as Record<(typeof SUPPORTED_CHAINS)[number]['id'], Transport>
  })
  return { wallet, config, queryClient: new QueryClient({ defaultOptions: { queries: { retry: 1 } } }) }
}
type TSession = ReturnType<typeof createSession>

export function WidgetPlayground(props: {
  initialChain?: string
  initialAddress?: string
  headerInsideCard?: boolean
}) {
  const [revision, setRevision] = useState(0)
  return <DemoSession key={revision} {...props} onReset={() => setRevision((value) => value + 1)} />
}

function DemoSession({
  onReset,
  ...props
}: {
  onReset: () => void
  initialChain?: string
  initialAddress?: string
  headerInsideCard?: boolean
}) {
  const [session] = useState(createSession)
  return (
    <DemoContext.Provider value>
      <WagmiProvider config={session.config} reconnectOnMount={false}>
        <QueryClientProvider client={session.queryClient}>
          <DemoWalletContext.Provider value={session.wallet}>
            <DemoHost session={session} onReset={onReset} {...props} />
          </DemoWalletContext.Provider>
        </QueryClientProvider>
      </WagmiProvider>
    </DemoContext.Provider>
  )
}

function DemoHost({
  session,
  onReset,
  ...props
}: {
  session: TSession
  onReset: () => void
  initialChain?: string
  initialAddress?: string
  headerInsideCard?: boolean
}) {
  const { address, chainId, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  const connectDemo = () => connect(session.config, { connector: session.config.connectors[0] })
  // Wagmi's connector lifecycle needs a mounted provider; no external wallet is contacted.
  useEffect(() => {
    void connect(session.config, { connector: session.config.connectors[0] }).catch(() => setConnectionError(true))
  }, [session])
  return (
    <VaultWidgetRuntimeProvider
      value={{
        ...DEFAULT_VAULT_WIDGET_RUNTIME,
        wallet: {
          ...DEFAULT_VAULT_WIDGET_RUNTIME.wallet,
          address,
          chainId,
          connected: isConnected,
          open: async () => {
            await connectDemo()
          },
          refresh: () => queryClient.invalidateQueries()
        },
        execution: {
          ...session.wallet.execution,
          switchChain: async ({ chainId: next }) => {
            await session.config.connectors[0].switchChain?.({ chainId: next })
          }
        },
        chains: {
          ...DEFAULT_VAULT_WIDGET_RUNTIME.chains,
          getChain: (id) => {
            const chain = SUPPORTED_CHAINS.find((item) => item.id === id)
            return chain ? { id, name: chain.name } : undefined
          }
        },
        assets: { baseUri: 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main' },
        prices: { spotPriceEndpoint: 'https://yearn.fi/api/prices/spot' }
      }}
    >
      {isConnected ? (
        <VaultApp {...props} demo />
      ) : (
        <p role="status" className="mx-auto p-5">
          {connectionError ? 'Unable to start demo wallet.' : 'Starting demo wallet…'}
        </p>
      )}
      <aside
        aria-label="Demo controls"
        className="pointer-events-none fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm text-sm"
      >
        <details className="pointer-events-auto ml-auto w-fit rounded-lg border border-border bg-surface shadow-lg open:w-full">
          <summary className="cursor-pointer px-4 py-3 font-semibold">Demo mode</summary>
          <div className="space-y-3 px-4 pb-4">
            <p>Live vaults and quotes, simulated funds and transactions.</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={failure}
                  onChange={(event) => {
                    session.wallet.controls.fail = event.target.checked
                    setFailure(event.target.checked)
                  }}
                />
                Fail simulated transactions
              </label>
              <button type="button" className="underline" onClick={onReset}>
                Reset demo
              </button>
              <a href="/" className="underline">
                Live app
              </a>
            </div>
            <p className="text-xs text-text-secondary">
              Your sample wallet starts with unlocked yvUSD worth about 1,000 USDC, 25 steCRV LP tokens and a Curve
              stETH factory position worth 10 steCRV, plus 1,000 USDC on Base to test cross-chain deposits. Account
              withdrawal limits are simulated.
            </p>
          </div>
        </details>
      </aside>
    </VaultWidgetRuntimeProvider>
  )
}
