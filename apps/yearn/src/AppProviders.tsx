'use client'

import { IframeAutoConnect } from '@components/IframeAutoConnect'
import { useThemePreference } from '@hooks/useThemePreference'
import { AppSettingsContextApp } from '@pages/vaults/contexts/useAppSettings'
import { EnsoStatusProvider } from '@pages/vaults/contexts/useEnsoStatus'
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type TWalletDrawerContext, WalletDrawerContext } from '@yearn/wallet-ui/context'
import { ReownWalletModalOverrides } from '@yearn/wallet-ui/ReownWalletModalOverrides'
import { WalletDrawerProvider } from '@yearn/wallet-ui/WalletDrawer'
import { usePathname } from 'next/navigation'
import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { WagmiProvider } from 'wagmi'
import { AppClientEffects } from '@/AppClientEffects'
import { shouldLoadAppTokenLists } from '@/appRouteDataLoading'
import { TenderlyControlPanel } from '@/components/shared/components/TenderlyControlPanel'
import { AGENT_WALLET_ID } from '@/config/agentWallet'
import { YEARN_WAGMI_RECONNECT_ON_MOUNT } from '@/config/appkitConfig'
import { appKit, wagmiConfig } from '@/config/wagmi'
import { ChainsProvider } from '@/context/ChainsProvider'

const bigintPrototype = BigInt.prototype as unknown as { toJSON?: () => string }
if (!bigintPrototype.toJSON) {
  bigintPrototype.toJSON = function toJSON() {
    return this.toString()
  }
}

const appTokenLists = [
  'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/yearn.json',
  'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/popular.json'
]
const yearnAdditionalConnectorIds = [AGENT_WALLET_ID] as const
const embeddedWalletDrawerContext: TWalletDrawerContext = {
  dialogId: 'yearn-wallet-picker',
  isConnecting: false,
  isOpen: false,
  openWalletDrawer: () => undefined,
  toggleWalletDrawer: () => undefined
}

function YearnWalletUiProvider({ children, theme }: { children: ReactNode; theme: 'dark' | 'light' }): ReactElement {
  if (!appKit) {
    return (
      <WalletDrawerContext.Provider value={embeddedWalletDrawerContext}>
        <ReownWalletModalOverrides />
        <div className={'contents'}>{children}</div>
        {false}
      </WalletDrawerContext.Provider>
    )
  }

  return (
    <WalletDrawerProvider
      additionalConnectorIds={yearnAdditionalConnectorIds}
      appKit={appKit}
      appKitTheme={theme}
      desktopRight={'max(1rem, calc((100vw - 77rem) / 2 + 1rem))'}
      desktopTop={'calc(var(--header-height) + 0.5rem)'}
      dialogId={'yearn-wallet-picker'}
    >
      {children}
    </WalletDrawerProvider>
  )
}

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

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={YEARN_WAGMI_RECONNECT_ON_MOUNT}>
      <QueryClientProvider client={queryClient}>
        <ChainsProvider>
          <YearnWalletUiProvider theme={themePreference === 'light' ? 'light' : 'dark'}>
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
          </YearnWalletUiProvider>
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
    </WagmiProvider>
  )
}
