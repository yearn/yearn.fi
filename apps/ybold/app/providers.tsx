'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useWalletActivity, WalletActivityProvider } from '@ybold/components/WalletActivityProvider'
import { useWalletDrawer, WalletDrawerProvider } from '@ybold/components/WalletDrawer'
import { isSafeConnectorId, YBOLD_WAGMI_RECONNECT_ON_MOUNT } from '@ybold/lib/appkitConfig'
import { wagmiConfig } from '@ybold/lib/wagmi'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { useMemo, useState } from 'react'
import { useAccount, WagmiProvider } from 'wagmi'

const queryClient = new QueryClient()
const YEARN_ASSETS_BASE_URI =
  process.env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI ?? 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main'
const resolveExecutionChainId = (requestedChainId: number | undefined): number | undefined =>
  requestedChainId === 1 ? 1 : undefined
const VAULT_WIDGET_EXECUTION = createWagmiVaultWidgetExecutionAdapter({
  config: wagmiConfig,
  resolveExecutionChainId
})

function WidgetHostProvider({ children }: { children: React.ReactNode }) {
  const { notifications } = useWalletActivity()
  const { openWalletDrawer } = useWalletDrawer()
  const { address, chainId, connector, isConnecting, status } = useAccount()
  const [slippagePercent, setSlippagePercent] = useState(0.5)
  const [autoStake, setAutoStake] = useState(true)
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      assets: {
        baseUri: YEARN_ASSETS_BASE_URI,
        isDevelopment: process.env.NODE_ENV === 'development'
      },
      chains: {
        getChain: (requestedChainId) =>
          requestedChainId === 1
            ? {
                id: 1,
                name: 'Ethereum',
                blockExplorerUrl: 'https://etherscan.io'
              }
            : undefined,
        isConnectedToExecutionChain: (connectedChainId, targetChainId) => connectedChainId === targetChainId,
        resolveCanonicalChainId: (requestedChainId) => (requestedChainId === 1 ? 1 : undefined),
        resolveExecutionChainId
      },
      execution: VAULT_WIDGET_EXECUTION,
      notifications,
      prices: {
        spotPriceEndpoint: '/api/prices/spot'
      },
      routing: {
        isEnsoEnabled: () => false
      },
      safe: {
        isSafe: isSafeConnectorId(connector?.id)
      },
      settings: {
        autoStake,
        setAutoStake,
        setSlippagePercent,
        slippagePercent
      },
      wallet: {
        address,
        chainId,
        connected: status === 'connected',
        connecting: isConnecting,
        open: openWalletDrawer
      }
    }),
    [address, autoStake, chainId, connector?.id, isConnecting, notifications, openWalletDrawer, slippagePercent, status]
  )

  return <VaultWidgetRuntimeProvider value={runtime}>{children}</VaultWidgetRuntimeProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={YBOLD_WAGMI_RECONNECT_ON_MOUNT}>
      <QueryClientProvider client={queryClient}>
        <WalletActivityProvider>
          <WalletDrawerProvider>
            <WidgetHostProvider>{children}</WidgetHostProvider>
          </WalletDrawerProvider>
        </WalletActivityProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
