'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider, useAccountModal } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { useWalletDrawer, WalletDrawerProvider, WalletProvider } from '@yearn/wallet-ui'
import { getYearnRainbowTheme } from '@yearn/wallet-ui/rainbowkit'
import { type ReactNode, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { useThemePreference } from '@/lib/theme'
import { wagmiConfig } from '@/lib/wagmi'

const resolveExecutionChainId = (chainId: number | undefined) => (chainId === 1 ? 1 : undefined)
const execution = createWagmiVaultWidgetExecutionAdapter({ config: wagmiConfig, resolveExecutionChainId })

function WidgetHostProvider({ children }: { children: ReactNode }) {
  const { address, chainId, connector, status } = useAccount()
  const { openWalletDrawer, isConnecting } = useWalletDrawer()
  const { openAccountModal } = useAccountModal()
  const queryClient = useQueryClient()
  const [slippagePercent, setSlippagePercent] = useState(0)
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
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
        connected: status === 'connected',
        connecting: isConnecting,
        open: status === 'connected' ? (openAccountModal ?? openWalletDrawer) : openWalletDrawer,
        refresh: () => queryClient.invalidateQueries()
      }
    }),
    [
      address,
      chainId,
      connector,
      isConnecting,
      openAccountModal,
      openWalletDrawer,
      queryClient,
      slippagePercent,
      status
    ]
  )
  return <VaultWidgetRuntimeProvider value={runtime}>{children}</VaultWidgetRuntimeProvider>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [theme] = useThemePreference()
  return (
    <WalletProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={getYearnRainbowTheme(theme)}>
          <WalletDrawerProvider
            anchorToTrigger
            desktopTop="calc(74px + 0.5rem)"
            desktopRight="max(2rem, calc((100% - 1344px) / 2 + 2rem))"
            themeClassName="ytranche-wallet-ui"
          >
            <WidgetHostProvider>{children}</WidgetHostProvider>
          </WalletDrawerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WalletProvider>
  )
}
