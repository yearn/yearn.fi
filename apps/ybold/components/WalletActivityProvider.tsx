'use client'

import {
  MAX_YBOLD_WALLET_ACTIVITIES,
  parseYboldWalletActivities,
  type TYboldWalletActivity
} from '@ybold/lib/walletActivity'
import { useVaultWidgetActivities } from '@yearn/vault-widget/runtime'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

const WALLET_ACTIVITY_STORAGE_KEY = 'ybold-wallet-activity-v1'
type TWalletActivityContext = { activities: readonly TYboldWalletActivity[] }
const WalletActivityContext = createContext<TWalletActivityContext | undefined>(undefined)

export function useWalletActivity(): TWalletActivityContext {
  const context = useContext(WalletActivityContext)
  if (!context) throw new Error('useWalletActivity must be used within WalletActivityProvider')
  return context
}

export function WalletActivityProvider({ children }: { children: ReactNode }) {
  const current = useVaultWidgetActivities({ allWallets: true })
  const [stored, setStored] = useState<TYboldWalletActivity[]>([])
  const [loaded, setLoaded] = useState(false)
  // Hydrate the browser's activity display; execution and status updates belong to the lifecycle.
  useEffect(() => {
    try {
      setStored(parseYboldWalletActivities(localStorage.getItem(WALLET_ACTIVITY_STORAGE_KEY)))
    } catch {
      /* History remains available for the current session. */
    }
    setLoaded(true)
  }, [])
  const activities = useMemo(
    () =>
      [...new Map([...stored, ...current].map((activity) => [activity.id, activity])).values()]
        .toSorted((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
        .slice(0, MAX_YBOLD_WALLET_ACTIVITIES),
    [stored, current]
  )
  // Persist display snapshots so completed activities remain visible after reloading.
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(WALLET_ACTIVITY_STORAGE_KEY, JSON.stringify(activities))
    } catch {
      /* History remains available for the current session. */
    }
  }, [activities, loaded])
  return <WalletActivityContext.Provider value={{ activities }}>{children}</WalletActivityContext.Provider>
}
