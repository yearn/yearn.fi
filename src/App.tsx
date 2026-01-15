import { DevToolbar } from '@components/DevToolbar'
import { IframeAutoConnect } from '@components/IframeAutoConnect'
import AppHeader from '@lib/components/Header'
import { Meta } from '@lib/components/Meta'
import { WithFonts } from '@lib/components/WithFonts'
import { ChartStyleContextApp } from '@lib/contexts/useChartStyle'
import { IndexedDB } from '@lib/contexts/useIndexedDB'
import { WithNotifications } from '@lib/contexts/useNotifications'
import { WithNotificationsActions } from '@lib/contexts/useNotificationsActions'
import { WalletContextApp } from '@lib/contexts/useWallet'
import { Web3ContextApp } from '@lib/contexts/useWeb3'
import { YearnContextApp } from '@lib/contexts/useYearn'
import { WithTokenList } from '@lib/contexts/WithTokenList'
import { useCurrentApp } from '@lib/hooks/useCurrentApp'
import { IconAlertCritical } from '@lib/icons/IconAlertCritical'
import { IconAlertError } from '@lib/icons/IconAlertError'
import { IconCheckmark } from '@lib/icons/IconCheckmark'
import { cl } from '@lib/utils'
import { isIframe } from '@lib/utils/helpers'
import { defaultSWRConfig } from '@lib/utils/swrConfig'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSettingsContextApp } from '@vaults/contexts/useAppSettings'
import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useLocation } from 'react-router'
import { SWRConfig } from 'swr'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { ChainsProvider } from '@/context/ChainsProvider'
import { DevFlagsProvider } from '/src/contexts/useDevFlags'
import PlausibleProvider from './components/PlausibleProvider'
import { AppRoutes } from './routes'

const queryClient = new QueryClient()

function WithLayout(): ReactElement {
  return (
    <>
      <div className={'sticky top-0 z-60 w-full'}>
        <AppHeader />
      </div>
      <div id={'app'} className={cl('mx-auto mb-0 flex')}>
        <div className={'block size-full min-h-max'}>
          <AppRoutes />
        </div>
      </div>
    </>
  )
}

function App(): ReactElement {
  const location = useLocation()
  const { manifest } = useCurrentApp()

  // Scroll to top on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on pathname change only
  useEffect(() => {
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
          <PlausibleProvider domain={'yearn.fi'} enabled={true}>
            <WagmiProvider config={wagmiConfig} reconnectOnMount={!isIframe()}>
              <QueryClientProvider client={queryClient}>
                <SWRConfig value={defaultSWRConfig}>
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
                                          <DevFlagsProvider>
                                            <WithLayout />
                                            <DevToolbar />
                                          </DevFlagsProvider>
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
                </SWRConfig>
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
