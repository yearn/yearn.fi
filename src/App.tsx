import { IframeAutoConnect } from '@components/IframeAutoConnect'
import { ScrollToTopButton } from '@pages/vaults/components/detail/ScrollToTopButton'
import { AppSettingsContextApp } from '@pages/vaults/contexts/useAppSettings'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import AppHeader from '@shared/components/Header'
import { Meta } from '@shared/components/Meta'
import { WithFonts } from '@shared/components/WithFonts'
import { ChartStyleContextApp } from '@shared/contexts/useChartStyle'
import { IndexedDB } from '@shared/contexts/useIndexedDB'
import { WithNotifications } from '@shared/contexts/useNotifications'
import { WithNotificationsActions } from '@shared/contexts/useNotificationsActions'
import { WalletContextApp } from '@shared/contexts/useWallet'
import { Web3ContextApp } from '@shared/contexts/useWeb3'
import { YearnContextApp } from '@shared/contexts/useYearn'
import { WithTokenList } from '@shared/contexts/WithTokenList'
import { useCurrentApp } from '@shared/hooks/useCurrentApp'
import { IconAlertCritical } from '@shared/icons/IconAlertCritical'
import { IconAlertError } from '@shared/icons/IconAlertError'
import { IconCheckmark } from '@shared/icons/IconCheckmark'
import { cl } from '@shared/utils'
import { isIframe } from '@shared/utils/helpers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { useLayoutEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useLocation } from 'react-router'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { ChainsProvider } from '@/context/ChainsProvider'
import PlausibleProvider from './components/PlausibleProvider'
import { Routes } from './routes'

const queryClient = new QueryClient()

function WithLayout(): ReactElement {
  return (
    <>
      <div className={'sticky top-0 z-60 w-full max-md:fixed max-md:inset-x-0'}>
        <AppHeader />
      </div>
      <div id={'app'} className={cl('mx-auto mb-0 flex', 'max-md:pt-[var(--header-height)]')}>
        <div className={'block size-full min-h-max'}>
          <Routes />
        </div>
      </div>
      <ScrollToTopButton className="bottom-20 right-4 md:bottom-6 md:right-6" />
    </>
  )
}

function App(): ReactElement {
  const location = useLocation()
  const { manifest } = useCurrentApp()

  // Scroll to top on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on pathname change only
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Determine dynamic meta for vault detail pages
  const asPath = location.pathname

  // Get most basic og and uri info
  const ogBaseUrl = 'https://og.yearn.fi'
  const isVaultDetailPage = asPath.startsWith('/vaults/') && asPath.split('/').length === 4
  const [, , chainID, address] = isVaultDetailPage ? asPath.split('/') : []
  const ogUrl = isVaultDetailPage
    ? `${ogBaseUrl}/api/og/yearn/vault/${chainID}/${address}`
    : manifest.og || 'https://yearn.fi/og.png'
  const pageUri = isVaultDetailPage ? `https://yearn.fi${asPath}` : manifest.uri || 'https://yearn.fi'

  return (
    <>
      <Meta
        title={manifest.name || 'Yearn'}
        description={manifest.description || 'The yield protocol for digital assets'}
        titleColor={'#ffffff'}
        themeColor={'#000000'}
        og={ogUrl}
        uri={pageUri}
      />
      <WithFonts>
        <main className={'font-aeonik size-full min-h-screen'}>
          <PlausibleProvider enabled={true}>
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
                            <ChartStyleContextApp>
                              <YearnContextApp>
                                <WalletContextApp>
                                  <IndexedDB>
                                    <WithNotifications>
                                      <WithNotificationsActions>
                                        <WithLayout />
                                      </WithNotificationsActions>
                                    </WithNotifications>
                                  </IndexedDB>
                                </WalletContextApp>
                              </YearnContextApp>
                            </ChartStyleContextApp>
                          </AppSettingsContextApp>
                        </WithTokenList>
                      </Web3ContextApp>
                    </IframeAutoConnect>
                  </RainbowKitProvider>
                </ChainsProvider>
              </QueryClientProvider>
            </WagmiProvider>
          </PlausibleProvider>
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
      </WithFonts>
    </>
  )
}

export default App
