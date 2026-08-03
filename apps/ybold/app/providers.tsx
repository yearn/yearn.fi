'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { lightTheme, RainbowKitProvider, useConnectModal } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@ybold/lib/wagmi'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget'
import { useMemo, useState } from 'react'
import { useAccount, WagmiProvider } from 'wagmi'

const theme = lightTheme({
  accentColor: '#0657f9',
  borderRadius: 'medium'
})

theme.radii.connectButton = '9999px'

const queryClient = new QueryClient()
const YEARN_ASSETS_BASE_URI =
  process.env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI ?? 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main'

function WidgetHostProvider({ children }: { children: React.ReactNode }) {
  const { openConnectModal } = useConnectModal()
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
        resolveExecutionChainId: (requestedChainId) => (requestedChainId === 1 ? 1 : undefined)
      },
      prices: {
        spotPriceEndpoint: '/api/prices/spot'
      },
      routing: {
        ensoRouteEndpoint: '/api/enso/route',
        isEnsoEnabled: () => false
      },
      safe: {
        isSafe: connector?.id.toLowerCase().includes('safe') === true
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
        open: () => openConnectModal?.()
      }
    }),
    [address, autoStake, chainId, connector?.id, isConnecting, openConnectModal, slippagePercent, status]
  )

  return <VaultWidgetRuntimeProvider value={runtime}>{children}</VaultWidgetRuntimeProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <WidgetHostProvider>{children}</WidgetHostProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
