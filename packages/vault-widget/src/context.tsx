'use client'

import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react'
import {
  createBrowserSettingsStore,
  createHttpEnsoBridgeStatusProvider,
  createHttpRewardDiscoveryService,
  createKongVaultConfigResolver,
  createMemoryActivityStore,
  createWagmiSafeExecutionService,
  type VaultWidgetServices
} from './services'

const defaultServices: VaultWidgetServices = {
  activityStore: createMemoryActivityStore(),
  configResolver: createKongVaultConfigResolver(),
  ensoBridge: createHttpEnsoBridgeStatusProvider(),
  execution: createWagmiSafeExecutionService(),
  rewards: createHttpRewardDiscoveryService(),
  settings: createBrowserSettingsStore()
}

const VaultWidgetServicesContext = createContext<VaultWidgetServices>(defaultServices)

export type VaultWidgetProviderProps = {
  children: ReactNode
  services?: Partial<VaultWidgetServices>
}

export function VaultWidgetProvider({ children, services }: VaultWidgetProviderProps): ReactElement {
  const parent = useContext(VaultWidgetServicesContext)
  const value = useMemo(
    (): VaultWidgetServices => ({
      activityStore: services?.activityStore ?? parent.activityStore,
      configResolver: services?.configResolver ?? parent.configResolver,
      enso: services?.enso ?? parent.enso,
      ensoBridge: services?.ensoBridge ?? parent.ensoBridge,
      execution: services?.execution ?? parent.execution,
      rewards: services?.rewards ?? parent.rewards,
      settings: services?.settings ?? parent.settings
    }),
    [parent, services]
  )

  return <VaultWidgetServicesContext.Provider value={value}>{children}</VaultWidgetServicesContext.Provider>
}

export function useVaultWidgetServices(): VaultWidgetServices {
  return useContext(VaultWidgetServicesContext)
}
