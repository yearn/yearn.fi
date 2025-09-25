import { LandingAppHeader } from '@landing/components/common/Header'
import AppHeader from '@lib/components/Header'
import { Meta } from '@lib/components/Meta'
import { WithFonts } from '@lib/components/WithFonts'
import { IndexedDB } from '@lib/contexts/useIndexedDB'
import { WithNotifications } from '@lib/contexts/useNotifications'
import { WithNotificationsActions } from '@lib/contexts/useNotificationsActions'
import { WalletContextApp } from '@lib/contexts/useWallet'
import { YearnContextApp } from '@lib/contexts/useYearn'
import { WithMom } from '@lib/contexts/WithMom'
import { useCurrentApp } from '@lib/hooks/useCurrentApp'
import { IconAlertCritical } from '@lib/icons/IconAlertCritical'
import { IconAlertError } from '@lib/icons/IconAlertError'
import { IconCheckmark } from '@lib/icons/IconCheckmark'
import { cl } from '@lib/utils'
import { SUPPORTED_NETWORKS } from '@lib/utils/constants'
import { resolveRouteMeta } from '@lib/utils/ogMeta'
import { AppSettingsContextApp } from '@vaults-v2/contexts/useAppSettings'
import type { ReactElement } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import PlausibleProvider from './components/PlausibleProvider'
import { AppRoutes } from './routes'

function WithLayout(): ReactElement {
  const location = useLocation()
  const isAppsPage = location.pathname?.startsWith('/apps')
  const isHomePage = location.pathname === '/'

  if (isAppsPage) {
    return (
      <>
        <div className={cl('mx-auto mb-0 flex z-60 max-w-[1232px] absolute top-0 inset-x-0 px-4 bg-neutral-0')}>
          <AppHeader supportedNetworks={SUPPORTED_NETWORKS} />
        </div>
        <div id={'app'} className={'bg-neutral-0 mb-0 flex min-h-screen justify-center'}>
          <div className={'flex w-full max-w-[1230px] justify-start'}>
            <AppRoutes />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className={cl('mx-auto mb-0 flex z-60 max-w-[1232px] absolute top-0 inset-x-0 px-4')}>
        {isHomePage ? <LandingAppHeader /> : <AppHeader supportedNetworks={SUPPORTED_NETWORKS} />}
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
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined
  const routeMeta = resolveRouteMeta({ pathname: location.pathname, manifest, origin })

  return (
    <HelmetProvider>
      <WithFonts>
        <Meta
          title={routeMeta.title}
          description={routeMeta.description}
          titleColor={routeMeta.titleColor}
          themeColor={routeMeta.themeColor}
          og={routeMeta.og}
          uri={routeMeta.uri}
        />
        <main className={'font-aeonik size-full min-h-screen'}>
          <PlausibleProvider domain={'yearn.fi'} enabled={true}>
            <WithMom
              supportedChains={SUPPORTED_NETWORKS}
              tokenLists={[
                'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/yearn.json',
                'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/popular.json'
              ]}
            >
              <AppSettingsContextApp>
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
              </AppSettingsContextApp>
            </WithMom>
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
          />
        </main>
      </WithFonts>
    </HelmetProvider>
  )
}

export default App
