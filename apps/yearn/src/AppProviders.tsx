'use client'

import { IframeAutoConnect } from '@components/IframeAutoConnect'
import { usePlausible } from '@hooks/usePlausible'
import { useThemePreference } from '@hooks/useThemePreference'
import { AppSettingsContextApp } from '@pages/vaults/contexts/useAppSettings'
import { EnsoStatusProvider } from '@pages/vaults/contexts/useEnsoStatus'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { ChartStyleContextApp } from '@shared/contexts/useChartStyle'
import { IndexedDB } from '@shared/contexts/useIndexedDB'
import { WithNotifications } from '@shared/contexts/useNotifications'
import { WithNotificationsActions } from '@shared/contexts/useNotificationsActions'
import { TenderlyPanelProvider } from '@shared/contexts/useTenderlyPanel'
import { WalletContextApp } from '@shared/contexts/useWallet'
import { WalletVaultTotalsProvider } from '@shared/contexts/useWalletVaultTotals'
import { Web3ContextApp } from '@shared/contexts/useWeb3'
import { YearnContextApp } from '@shared/contexts/useYearn'
import { WithTokenList } from '@shared/contexts/WithTokenList'
import { IconAlertCritical } from '@shared/icons/IconAlertCritical'
import { IconAlertError } from '@shared/icons/IconAlertError'
import { IconCheckmark } from '@shared/icons/IconCheckmark'
import { isIframe } from '@shared/utils/helpers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getYearnRainbowTheme, WalletDrawerProvider, WalletProvider } from '@yearn/wallet-ui'
import type { TWalletAnalytics } from '@yearn/wallet-ui/analytics'
import { usePathname } from 'next/navigation'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AppClientEffects } from '@/AppClientEffects'
import { shouldLoadAppTokenLists } from '@/appRouteDataLoading'
import { TenderlyControlPanel } from '@/components/shared/components/TenderlyControlPanel'
import { AGENT_WALLET_ID } from '@/config/agentWallet'
import { wagmiConfig } from '@/config/wagmi'
import { ChainsProvider } from '@/context/ChainsProvider'

const bigintPrototype = BigInt.prototype as unknown as { toJSON?: () => string }
if (!bigintPrototype.toJSON) {
  bigintPrototype.toJSON = function toJSON() {
    return this.toString()
  }
}

const additionalConnectorIds = [AGENT_WALLET_ID]

const appTokenLists = [
  'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/yearn.json',
  'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/popular.json'
]

function TokenListGate({ children }: { children: ReactElement }): ReactElement {
  const pathname = usePathname() || '/'
  const shouldLoadTokenLists = shouldLoadAppTokenLists(pathname)

  return (
    <WithTokenList lists={appTokenLists} enabled={shouldLoadTokenLists}>
      {children}
    </WithTokenList>
  )
}

export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  const [queryClient] = useState(() => new QueryClient())
  const themePreference = useThemePreference()
  const track = usePlausible()
  const onWalletAnalytics = useCallback<TWalletAnalytics>(
    (event, props) => {
      track(event, { props: { ...props, app: 'yearn' } })
    },
    [track]
  )

  return (
    <WalletProvider config={wagmiConfig} reconnectOnMount={!isIframe()}>
      <QueryClientProvider client={queryClient}>
        <ChainsProvider>
          <RainbowKitProvider theme={getYearnRainbowTheme(themePreference === 'light' ? 'light' : 'dark')}>
            <WalletDrawerProvider
              onAnalytics={onWalletAnalytics}
              additionalConnectorIds={additionalConnectorIds}
              desktopTop="calc(var(--header-height) + 0.5rem)"
              desktopRight="max(1rem,calc((100vw - 1232px)/2 + 1rem))"
            >
              <IframeAutoConnect>
                <Web3ContextApp>
                  <TokenListGate>
                    <AppSettingsContextApp>
                      <EnsoStatusProvider>
                        <ChartStyleContextApp>
                          <YearnContextApp>
                            <WalletContextApp>
                              <WalletVaultTotalsProvider>
                                <IndexedDB>
                                  <WithNotifications>
                                    <WithNotificationsActions>
                                      <TenderlyPanelProvider>
                                        <AppClientEffects />
                                        {children}
                                        <TenderlyControlPanel />
                                      </TenderlyPanelProvider>
                                    </WithNotificationsActions>
                                  </WithNotifications>
                                </IndexedDB>
                              </WalletVaultTotalsProvider>
                            </WalletContextApp>
                          </YearnContextApp>
                        </ChartStyleContextApp>
                      </EnsoStatusProvider>
                    </AppSettingsContextApp>
                  </TokenListGate>
                </Web3ContextApp>
              </IframeAutoConnect>
            </WalletDrawerProvider>
          </RainbowKitProvider>
        </ChainsProvider>
      </QueryClientProvider>
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
    </WalletProvider>
  )
}
