'use client'

import { IframeAutoConnect } from '@components/IframeAutoConnect'
import { ScrollToTopButton } from '@pages/vaults/components/detail/ScrollToTopButton'
import { AppSettingsContextApp } from '@pages/vaults/contexts/useAppSettings'
import { EnsoStatusProvider } from '@pages/vaults/contexts/useEnsoStatus'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import AppHeader from '@shared/components/Header'
import { ChartStyleContextApp } from '@shared/contexts/useChartStyle'
import { IndexedDB } from '@shared/contexts/useIndexedDB'
import { WithNotifications } from '@shared/contexts/useNotifications'
import { WithNotificationsActions } from '@shared/contexts/useNotificationsActions'
import { TenderlyPanelProvider } from '@shared/contexts/useTenderlyPanel'
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
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { WagmiProvider } from 'wagmi'
import { TenderlyControlPanel } from '@/components/shared/components/TenderlyControlPanel'
import { wagmiConfig } from '@/config/wagmi'
import { ChainsProvider } from '@/context/ChainsProvider'
import { usePathname } from '@/hooks/usePathname'
import { initializePlausible } from '@/hooks/usePlausible'
import { NextNavigationProvider } from '@/navigation/NextNavigationProvider'
import { disableServiceWorkerDev } from '@/utils/disableServiceWorkerDev'

const bigintPrototype = BigInt.prototype as unknown as { toJSON?: () => string }
if (!bigintPrototype.toJSON) {
  bigintPrototype.toJSON = function toJSON() {
    return this.toString()
  }
}

function WithLayout({ children }: { children: ReactNode }): ReactElement {
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

function AppContent({ children }: { children: ReactNode }): ReactElement {
  const [queryClient] = useState(() => new QueryClient())
  const pathname = usePathname()

  // Scroll to top on route change
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    initializePlausible()

    if (process.env.NODE_ENV === 'development') {
      void disableServiceWorkerDev()
    }
  }, [])

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
                                    <TenderlyPanelProvider>
                                      <WithLayout>{children}</WithLayout>
                                      <TenderlyControlPanel />
                                    </TenderlyPanelProvider>
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

function App({ children }: { children: ReactNode }): ReactElement {
  return (
    <NextNavigationProvider>
      <AppContent>{children}</AppContent>
    </NextNavigationProvider>
  )
}

export default App
