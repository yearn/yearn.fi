'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@wrapped/lib/wagmi'
import { WalletDrawerProvider, WalletProvider } from '@yearn/wallet-ui'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <WalletProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletDrawerProvider desktopTop="5rem" desktopRight="1.5rem">
          {children}
        </WalletDrawerProvider>
      </QueryClientProvider>
    </WalletProvider>
  )
}
