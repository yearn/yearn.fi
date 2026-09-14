'use client'

import { hydrate } from '@wagmi/core'
import { restorePreviousAccount } from '@yearn/wallet-ui/connectionCleanup'
import { type PropsWithChildren, useEffect } from 'react'
import { type Config, type Connector, WagmiContext, type WagmiProviderProps } from 'wagmi'
import { getAccount, reconnect, watchAccount, watchConnectors } from 'wagmi/actions'

const hydrationKey = Symbol.for('yearn.wallet-ui.startup')
type TStartup = {
  hydration: Promise<void>
  reconnected: boolean
  attempt?: { connector: Connector; superseded: boolean; previousConnector?: Connector }
}
const browserState =
  typeof window === 'undefined' ? undefined : (window as Window & { [hydrationKey]?: WeakMap<Config, TStartup> })
if (browserState && !browserState[hydrationKey]) {
  browserState[hydrationKey] = new WeakMap<Config, TStartup>()
}
const startups = browserState?.[hydrationKey] ?? new WeakMap<Config, TStartup>()

export function cancelWalletReconnect(config: Config, selectedConnector?: Connector): void {
  const startup = startups.get(config)
  if (!startup) return
  startup.reconnected = true
  if (startup.attempt) startup.attempt.superseded = startup.attempt.connector.uid !== selectedConnector?.uid
}

export function WalletProvider({
  children,
  config,
  initialState,
  reconnectOnMount = true
}: PropsWithChildren<WagmiProviderProps>) {
  // Hydration/discovery is a Wagmi lifecycle. Restore only the last wallet, without probing every SDK/extension.
  useEffect(() => {
    const startup: TStartup = startups.get(config) ?? {
      hydration: hydrate(config, { initialState, reconnectOnMount: false }).onMount(),
      reconnected: false
    }
    startups.set(config, startup)
    const lifecycle = { cancelled: false, unwatch: () => {} }
    void startup.hydration
      .then(async () => {
        if (!reconnectOnMount || startup.reconnected || lifecycle.cancelled) return
        const recentId = await config.storage?.getItem('recentConnectorId')
        const connectorId =
          recentId ??
          (window.self !== window.top ? config.connectors.find(({ type }) => type === 'safe')?.id : undefined)
        if (!connectorId || lifecycle.cancelled) return

        const restore = () => {
          if (lifecycle.cancelled || startup.reconnected) return
          const connector = config.connectors.find(({ id }) => id === connectorId)
          if (!connector) return
          startup.reconnected = true
          lifecycle.unwatch()
          // A user connection started during hydration takes precedence over automatic restoration.
          if (getAccount(config).status !== 'disconnected') return
          const attempt = { connector, superseded: false, previousConnector: undefined as Connector | undefined }
          startup.attempt = attempt
          const unwatch = watchAccount(config, {
            onChange(account, previousAccount) {
              if (account.connector?.uid === connector.uid && previousAccount.connector?.uid !== connector.uid) {
                attempt.previousConnector = previousAccount.connector
                // Reconnect replaces its connection map. Retain the live account displaced by an obsolete restore.
                if (
                  attempt.superseded &&
                  previousAccount.connector &&
                  previousAccount.addresses?.[0] &&
                  previousAccount.chainId !== undefined
                ) {
                  const previous = {
                    connector: previousAccount.connector,
                    accounts: previousAccount.addresses,
                    chainId: previousAccount.chainId
                  }
                  config.setState((state) => ({
                    ...state,
                    connections: new Map(state.connections).set(previous.connector.uid, {
                      ...previous,
                      accounts: [previous.accounts[0], ...previous.accounts.slice(1)]
                    })
                  }))
                }
              }
            }
          })
          void reconnect(config, { connectors: [connector] })
            .then(async () => {
              if (attempt.superseded) await restorePreviousAccount(config, attempt)
            })
            .catch(() => undefined)
            .finally(() => {
              unwatch()
              startup.attempt = undefined
            })
        }
        // An installed EIP-6963 wallet may announce after hydration; wait for that wallet only.
        const unwatchConnectors = watchConnectors(config, { onChange: restore })
        const unwatchAccount = watchAccount(config, {
          onChange(account) {
            if (account.status === 'disconnected') return
            startup.reconnected = true
            lifecycle.unwatch()
          }
        })
        lifecycle.unwatch = () => {
          unwatchConnectors()
          unwatchAccount()
        }
        restore()
      })
      .catch(() => undefined)
    return () => {
      lifecycle.cancelled = true
      lifecycle.unwatch()
    }
  }, [config, initialState, reconnectOnMount])

  return <WagmiContext.Provider value={config}>{children}</WagmiContext.Provider>
}
