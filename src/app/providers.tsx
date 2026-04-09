'use client'

import { IframeAutoConnect } from '@components/IframeAutoConnect'
import { ScrollToTopButton } from '@pages/vaults/components/detail/ScrollToTopButton'
import { AppSettingsContextApp } from '@pages/vaults/contexts/useAppSettings'
import { EnsoStatusProvider } from '@pages/vaults/contexts/useEnsoStatus'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import AppHeader from '@shared/components/Header'
import { ChartStyleContextApp } from '@shared/contexts/useChartStyle'
import { WalletContextApp } from '@shared/contexts/useWallet'
import { Web3ContextApp } from '@shared/contexts/useWeb3'
import { YearnContextApp } from '@shared/contexts/useYearn'
import { WithTokenList } from '@shared/contexts/WithTokenList'
import { IconAlertCritical } from '@shared/icons/IconAlertCritical'
import { IconAlertError } from '@shared/icons/IconAlertError'
import { IconCheckmark } from '@shared/icons/IconCheckmark'
import { cl } from '@shared/utils'
import { isIframe } from '@shared/utils/helpers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { ChainsProvider } from '@/context/ChainsProvider'
import { usePlausible } from '@hooks/usePlausible'

const IndexedDB = dynamic(() => import('@shared/contexts/useIndexedDB').then((mod) => mod.IndexedDB), { ssr: false })
const WithNotifications = dynamic(() => import('@shared/contexts/useNotifications').then((mod) => mod.WithNotifications), {
  ssr: false
})
const WithNotificationsActions = dynamic(
  () => import('@shared/contexts/useNotificationsActions').then((mod) => mod.WithNotificationsActions),
  { ssr: false }
)

function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={'sticky top-0 z-60 w-full max-md:fixed max-md:inset-x-0'}>
        <AppHeader />
      </div>
      <div id={'app'} className={cl('mx-auto mb-0 flex', 'max-md:pt-[var(--header-height)]')}>
        <div className={'block size-full min-h-max'}>{children}</div>
      </div>
      <ScrollToTopButton className="bottom-20 right-4 md:bottom-6 md:right-6" />
    </>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  usePlausible()

  return (
    <main className={'font-aeonik size-full min-h-screen'}>
      <WagmiProvider config={wagmiConfig} reconnectOnMount={!isIframe()}>
        <QueryClientProvider client={queryClient}>
          <ChainsProvider>
            <RainbowKitProvider>
              <IframeAutoConnect>
                <Web3ContextApp>
                  <WithTokenList
                    lists={[
                      'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/yearn.json',
                      'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/popular.json'
                    ]}
                  >
                    <AppSettingsContextApp>
                      <EnsoStatusProvider>
                        <ChartStyleContextApp>
                          <YearnContextApp>
                            <WalletContextApp>
                              <IndexedDB>
                                <WithNotifications>
                                  <WithNotificationsActions>
                                    <AppShell>{children}</AppShell>
                                  </WithNotificationsActions>
                                </WithNotifications>
                              </IndexedDB>
                            </WalletContextApp>
                          </YearnContextApp>
                        </ChartStyleContextApp>
                      </EnsoStatusProvider>
                    </AppSettingsContextApp>
                  </WithTokenList>
                </Web3ContextApp>
              </IframeAutoConnect>
            </RainbowKitProvider>
          </ChainsProvider>
        </QueryClientProvider>
      </WagmiProvider>
      <Toaster
        toastOptions={{
          duration: 5000,
          className: 'toast',
          error: {
            icon: <IconAlertCritical className={'ml-3'} />,
            style: {
              backgroundColor: '#C73203',
              color: 'white'
            }
          },
          success: {
            icon: <IconCheckmark className={'ml-3'} />,
            style: {
              backgroundColor: '#00796D',
              color: 'white'
            }
          },
          icon: <IconAlertError className={'ml-3'} />,
          style: {
            backgroundColor: '#0657F9',
            color: 'white'
          }
        }}
        position={'bottom-right'}
        containerStyle={{ maxWidth: 'calc(100vw - 32px)', width: '100%' }}
      />
    </main>
  )
}
