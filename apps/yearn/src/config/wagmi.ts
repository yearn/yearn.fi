'use client'

import { connect, disconnect, getAccount } from '@wagmi/core'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { registerConfig } from '@shared/utils/wagmi'
import { requireWalletConnectProjectId } from '@yearn/wallet-ui/appkit'
import { connectEvmWalletWithAppKit } from '@yearn/wallet-ui/connectors'
import { cookieStorage, createConfig, createStorage, type Connector } from 'wagmi'
import { safe } from 'wagmi/connectors'
import {
  createYearnAppKitOptions,
  createYearnCustomRpcUrls,
  YEARN_APPKIT_METADATA,
  YEARN_APPKIT_NETWORKS
} from '@/config/appkitConfig'
import { agentWallet, isAgentWalletEnabled } from '@/config/agentWallet'
import { ledgerWallet } from '@/config/ledgerWallet'
import { buildTransports } from '@/config/wagmiTransports'
import {
  getYearnWagmiStorageKey,
  resolveYearnWalletRuntime,
  type TYearnWalletRuntime
} from '@/config/walletRuntime'
import { env } from '@/env'

const projectId = requireWalletConnectProjectId(env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string | undefined)
const customRpcUrls = createYearnCustomRpcUrls()
export const yearnWalletRuntime = resolveYearnWalletRuntime()

function createYearnWalletRuntimeState(runtime: TYearnWalletRuntime) {
  const storage = createStorage({ key: getYearnWagmiStorageKey(runtime), storage: cookieStorage })
  const transports = buildTransports(YEARN_APPKIT_NETWORKS)

  if (runtime !== 'app') {
    const iframeConnector =
      runtime === 'safe-iframe' ? safe() : ledgerWallet({ metadata: YEARN_APPKIT_METADATA, projectId })
    const wagmiConfig = createConfig({
      chains: YEARN_APPKIT_NETWORKS,
      connectors: [iframeConnector],
      multiInjectedProviderDiscovery: false,
      ssr: true,
      storage,
      transports
    })

    return { appKit: undefined, wagmiAdapter: undefined, wagmiConfig }
  }

  const connectors = isAgentWalletEnabled() ? [agentWallet()] : []
  const wagmiAdapter = new WagmiAdapter({
    connectors,
    customRpcUrls,
    networks: YEARN_APPKIT_NETWORKS,
    projectId,
    ssr: true,
    storage,
    transports
  })
  const appKit =
    typeof window === 'undefined'
      ? undefined
      : createAppKit(createYearnAppKitOptions(wagmiAdapter, projectId, customRpcUrls))

  return { appKit, wagmiAdapter, wagmiConfig: wagmiAdapter.wagmiConfig }
}

const walletRuntimeState = createYearnWalletRuntimeState(yearnWalletRuntime)

export const wagmiAdapter = walletRuntimeState.wagmiAdapter
export const wagmiConfig = walletRuntimeState.wagmiConfig
export const appKit = walletRuntimeState.appKit

const iframeConnectionState: { isExplicitlyDisconnected: boolean; promise?: Promise<boolean> } = {
  isExplicitlyDisconnected: false
}

export async function connectYearnWallet(connector: Connector): Promise<void> {
  if (appKit) {
    await connectEvmWalletWithAppKit(appKit, connector)
    return
  }

  await connect(wagmiConfig, { connector })
}

export async function disconnectYearnWallet(): Promise<void> {
  if (appKit) {
    await appKit.disconnect('eip155')
    return
  }

  iframeConnectionState.isExplicitlyDisconnected = true

  try {
    await iframeConnectionState.promise
  } catch {
    // An explicit disconnect still wins if an in-flight connection failed.
  }

  await disconnect(wagmiConfig)
}

export function reconcileYearnIframeWallet(): Promise<boolean> {
  if (yearnWalletRuntime === 'app' || iframeConnectionState.isExplicitlyDisconnected) {
    return Promise.resolve(false)
  }

  if (iframeConnectionState.promise) {
    return iframeConnectionState.promise
  }

  const operation = (async (): Promise<boolean> => {
    const desiredConnector = wagmiConfig.connectors[0]
    if (!desiredConnector) {
      return false
    }

    const activeConnector = getAccount(wagmiConfig).connector

    if (activeConnector?.uid === desiredConnector.uid) {
      return true
    }

    if (
      yearnWalletRuntime === 'ledger-iframe' &&
      desiredConnector.type === 'walletConnect' &&
      !(await desiredConnector.isAuthorized())
    ) {
      return false
    }

    await connectYearnWallet(desiredConnector)
    return true
  })()

  iframeConnectionState.promise = operation.finally(() => {
    iframeConnectionState.promise = undefined
  })

  return iframeConnectionState.promise
}

export function requestYearnIframeWalletConnection(): Promise<boolean> {
  iframeConnectionState.isExplicitlyDisconnected = false
  return reconcileYearnIframeWallet()
}

registerConfig(wagmiConfig)

export type TWagmiConfig = typeof wagmiConfig
