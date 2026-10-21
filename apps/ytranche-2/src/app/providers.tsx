'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import {
  DEFAULT_YEARN_ASSETS_BASE_URI,
  type VaultWidgetRuntimeOverrides,
  VaultWidgetRuntimeProvider
} from '@yearn/vault-widget'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { useWalletDrawer, WalletDrawerProvider, WalletProvider } from '@yearn/wallet-ui'
import { getYearnRainbowTheme } from '@yearn/wallet-ui/rainbowkit'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { useThemePreference } from '@/lib/theme'
import { wagmiConfig } from '@/lib/wagmi'

const YEARN_ASSETS_BASE_URI = process.env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI || DEFAULT_YEARN_ASSETS_BASE_URI
const resolveExecutionChainId = (chainId: number | undefined) => (chainId === 1 ? 1 : undefined)
const execution = createWagmiVaultWidgetExecutionAdapter({ config: wagmiConfig, resolveExecutionChainId })

function WidgetHostProvider({ children }: { children: ReactNode }) {
  const { address, chainId, connector, isConnected } = useAccount()
  const { openWalletDrawer, isConnecting } = useWalletDrawer()
  const queryClient = useQueryClient()
  const [slippagePercent, setSlippagePercent] = useState(0)
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      assets: {
        baseUri: YEARN_ASSETS_BASE_URI,
        isDevelopment: process.env.NODE_ENV === 'development'
      },
      chains: {
        getChain: (id) =>
          id === 1 ? { id: 1, name: 'Ethereum', blockExplorerUrl: 'https://etherscan.io' } : undefined,
        resolveCanonicalChainId: resolveExecutionChainId,
        resolveExecutionChainId
      },
      execution,
      prices: { spotPriceEndpoint: '/api/prices/spot' },
      routing: { isEnsoEnabled: () => false },
      safe: { isSafe: connector?.id.toLowerCase() === 'safe' },
      settings: { autoStake: false, slippagePercent, setSlippagePercent },
      wallet: {
        address,
        chainId,
        connected: isConnected,
        connecting: isConnecting,
        open: openWalletDrawer,
        refresh: () => queryClient.invalidateQueries()
      }
    }),
    [address, chainId, connector, isConnecting, isConnected, openWalletDrawer, queryClient, slippagePercent]
  )
  return <VaultWidgetRuntimeProvider value={runtime}>{children}</VaultWidgetRuntimeProvider>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [theme] = useThemePreference()
  const rainbowTheme = getYearnRainbowTheme(theme)
  const walletTheme = {
    ...rainbowTheme,
    colors: {
      ...rainbowTheme.colors,
      accentColor: 'var(--earn-blue)',
      modalBackground: 'var(--earn-surface)',
      modalText: 'var(--earn-ink)',
      modalTextSecondary: 'var(--earn-muted)',
      modalBorder: 'var(--earn-line)',
      generalBorder: 'var(--earn-line)',
      menuItemBackground: 'var(--earn-surface-soft)',
      closeButton: 'var(--earn-muted)',
      closeButtonBackground: 'var(--earn-surface-soft)',
      modalBackdrop: 'rgba(11, 16, 32, 0.6)'
    }
  }
  // The product stylesheet uses a binary DOM theme; wallet surfaces use the shared theme variants.
  useEffect(() => {
    document.documentElement.dataset.ytrancheTheme = theme
  }, [theme])
  return (
    <WalletProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={walletTheme}>
          <WalletDrawerProvider
            anchorToTrigger
            themeClassName="ytranche-wallet-ui"
            desktopTop="calc(var(--header-height) + 0.5rem)"
            desktopRight="max(1rem, calc((100vw - 1232px) / 2 + 1rem))"
          >
            <WidgetHostProvider>{children}</WidgetHostProvider>
          </WalletDrawerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WalletProvider>
  )
}
