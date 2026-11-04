'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { WalletActivityContext } from '@erc4626/components/WalletActivity'
import { getChain, resolveChainId } from '@erc4626/lib/chains'
import { getSafeTransactionDetails } from '@erc4626/lib/safe'
import { wagmiConfig } from '@erc4626/lib/wagmiConfig'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useThemePreference } from '@yearn/site-header/theme'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget'
import { useVaultWidgetActivities } from '@yearn/vault-widget/runtime'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { useWalletDrawer, WalletDrawerProvider, WalletProvider } from '@yearn/wallet-ui'
import { getYearnRainbowTheme } from '@yearn/wallet-ui/rainbowkit'
import { type ReactNode, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'

const refreshVaultReads = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['erc4626-vault'] }),
    queryClient.invalidateQueries({ queryKey: ['erc4626-wallet-vaults'] }),
    queryClient.invalidateQueries({ queryKey: ['readContract'] })
  ])

const execution = createWagmiVaultWidgetExecutionAdapter({
  config: wagmiConfig,
  resolveExecutionChainId: resolveChainId
})

function WidgetHost({ children }: { children: ReactNode }) {
  const { address, chainId, connector, isConnected } = useAccount()
  const { openWalletDrawer, isConnecting } = useWalletDrawer()
  const queryClient = useQueryClient()
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      wallet: {
        connectorId: connector?.id,
        address,
        chainId,
        connected: isConnected,
        connecting: isConnecting,
        open: openWalletDrawer,
        refresh: () => refreshVaultReads(queryClient)
      },
      chains: {
        resolveExecutionChainId: resolveChainId,
        resolveCanonicalChainId: resolveChainId,
        isConnectedToExecutionChain: (connected, target) => connected === target,
        getChain: (id) => {
          const chain = getChain(id)
          return chain ? { id, name: chain.name, blockExplorerUrl: chain.blockExplorers.default.url } : undefined
        }
      },
      execution,
      safe: {
        isSafe: connector?.id.toLowerCase().includes('safe') === true,
        getTransactionDetails: getSafeTransactionDetails
      },
      assets: { baseUri: 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main' },
      routing: { isEnsoEnabled: () => false }
    }),
    [address, chainId, connector?.id, isConnected, isConnecting, openWalletDrawer, queryClient]
  )
  return (
    <VaultWidgetRuntimeProvider value={runtime}>
      <TransactionActivity>{children}</TransactionActivity>
    </VaultWidgetRuntimeProvider>
  )
}

function TransactionActivity({ children }: { children: ReactNode }) {
  const activities = useVaultWidgetActivities().slice(0, 10)
  return (
    <WalletActivityContext.Provider value={activities}>
      {children}
      {activities.length > 0 && (
        <aside id="recent-transactions" aria-label="Recent transactions" className="mx-auto mb-12 w-full max-w-xl px-5">
          <h2 className="mb-3 text-sm font-semibold">Recent transactions</h2>
          <ul className="space-y-2">
            {activities.map((activity) => (
              <Notice key={activity.id} activity={activity} />
            ))}
          </ul>
        </aside>
      )}
    </WalletActivityContext.Provider>
  )
}

function Notice({ activity }: { activity: ReturnType<typeof useVaultWidgetActivities>[number] }) {
  const explorer = getChain(activity.chainId)?.blockExplorers.default.url
  const label =
    activity.status === 'success'
      ? 'Confirmed'
      : activity.status === 'error'
        ? 'Failed'
        : activity.awaitingExecution
          ? 'Awaiting wallet execution'
          : 'Pending'
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
      <span className="capitalize">
        {activity.type} · {label}
      </span>
      {activity.txHash && explorer && (
        <a href={`${explorer}/tx/${activity.txHash}`} target="_blank" rel="noreferrer" className="underline">
          View transaction
        </a>
      )}
    </li>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const theme = getYearnRainbowTheme(useThemePreference() === 'light' ? 'light' : 'dark')
  return (
    <WalletProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <WalletDrawerProvider
            desktopTop="calc(var(--header-height) + 0.5rem)"
            desktopRight="max(1rem, calc((100vw - 1232px) / 2 + 1rem))"
          >
            <WidgetHost>{children}</WidgetHost>
          </WalletDrawerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WalletProvider>
  )
}
