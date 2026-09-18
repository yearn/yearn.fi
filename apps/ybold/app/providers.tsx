'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useWalletActivity, WalletActivityProvider } from '@ybold/components/WalletActivityProvider'
import { initializeAnalytics, trackAnalytics } from '@ybold/lib/analytics'
import { wagmiConfig } from '@ybold/lib/wagmi'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { useWalletDrawer, WalletDrawerProvider, WalletProvider } from '@yearn/wallet-ui'
import { getWalletAnalyticsProperties } from '@yearn/wallet-ui/analytics'
import { getYearnRainbowTheme } from '@yearn/wallet-ui/rainbowkit'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'

const theme = getYearnRainbowTheme('light')

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
  const { openWalletDrawer, isConnecting } = useWalletDrawer()
  const { address, chainId, connector, status } = useAccount()
  const [slippagePercent, setSlippagePercent] = useState(0.5)
  const [autoStake, setAutoStake] = useState(true)
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      analytics: {
        track: (event, props) => {
          void getWalletAnalyticsProperties(connector)
            .then((wallet) =>
              trackAnalytics(event, {
                ...wallet,
                ...Object.fromEntries(
                  Object.entries(props ?? {})
                    .filter(([, value]) => value !== undefined && value !== null)
                    .map(([key, value]) => [key, String(value)])
                )
              })
            )
            .catch(() => undefined)
        }
      },
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
        open: openWalletDrawer
      }
    }),
    [address, autoStake, chainId, connector, isConnecting, notifications, openWalletDrawer, slippagePercent, status]
  )

  return <VaultWidgetRuntimeProvider value={runtime}>{children}</VaultWidgetRuntimeProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize the browser analytics client once after hydration.
  useEffect(() => {
    void initializeAnalytics()?.catch(() => undefined)
  }, [])
  return (
    <WalletProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <WalletDrawerProvider
            onAnalytics={trackAnalytics}
            desktopTop="5rem"
            desktopRight="max(1.5rem, calc((100vw - 72rem) / 2 + 1.5rem))"
            themeClassName="ybold-wallet-ui"
          >
            <WalletActivityProvider>
              <WidgetHostProvider>{children}</WidgetHostProvider>
            </WalletActivityProvider>
          </WalletDrawerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WalletProvider>
  )
}
